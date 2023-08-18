import { DeployFunction } from "hardhat-deploy/types";
import {
  MarketplaceMock__factory,
  MerkleVerifier__factory,
  PolicyManager__factory,
  WETH__factory,
  IExecutionDelegate__factory,
  TransparentUpgradeableProxy__factory,
} from "../types";
import { Ship } from "../utils";
import { weth } from "../configs/weth";

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  const merkleVerifier = await connect(MerkleVerifier__factory);
  const executionDelegateProxy = await connect("ExecutionDelegateProxy");
  const policyManager = await connect(PolicyManager__factory);

  const implement = await deploy(MarketplaceMock__factory, {
    libraries: { MerkleVerifier: merkleVerifier.address },
  });
  let wethAddress;
  if (hre.network.tags.test) {
    wethAddress = (await connect(WETH__factory)).address;
  } else {
    wethAddress = (weth as any)[hre.network.name.toLowerCase()];
  }

  const initializeTransaction = await implement.contract.populateTransaction.initialize(
    hre.network.config.chainId as number,
    wethAddress,
    executionDelegateProxy.address,
    policyManager.address,
    accounts.signer.address,
    5,
  );
  const proxy = await deploy(TransparentUpgradeableProxy__factory, {
    aliasName: "MarketplaceMockProxy",
    args: [implement.address, accounts.vault.address, initializeTransaction.data as string],
  });

  if (proxy.newlyDeployed) {
    const executionDelegate = IExecutionDelegate__factory.connect(
      executionDelegateProxy.address,
      accounts.deployer,
    );
    const tx = await executionDelegate.approveContract(proxy.address);
    console.log("Approving proxy contract at");
    await tx.wait();
  }
};

export default func;
func.dependencies = ["execution-delegate", "merkle-verifier", "policy-manager", "mocks"];
func.tags = ["marketplace-mock"];
