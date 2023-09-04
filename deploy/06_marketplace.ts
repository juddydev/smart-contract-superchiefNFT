import { DeployFunction } from "hardhat-deploy/types";
import {
  TransparentUpgradeableProxy__factory,
  IExecutionDelegate__factory,
  MarketplaceMock__factory,
  Marketplace__factory,
  MerkleVerifier__factory,
  PolicyManager__factory,
  WETH__factory,
} from "../types";
import { Ship } from "../utils";
import { weth } from "../configs/weth";
import { arrayify, solidityKeccak256, splitSignature } from "ethers/lib/utils";
import { Signer } from "ethers";

export const getSign = async (address: string, nonce: number, signer: Signer) => {
  const hash = solidityKeccak256(["address", "uint256"], [address, nonce]);
  const signature = await signer.signMessage(arrayify(hash));

  // split signature
  const { r, s, v } = splitSignature(signature);

  return {
    r,
    s,
    v,
  };
};

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  const merkleVerifier = await connect(MerkleVerifier__factory);
  const executionDelegateProxy = await connect("ExecutionDelegateProxy");
  const policyManager = await connect(PolicyManager__factory);

  let implement;

  if (hre.network.tags.local) {
    implement = await deploy(MarketplaceMock__factory, {
      aliasName: "Marketplace",
      libraries: { MerkleVerifier: merkleVerifier.address },
    });
  } else {
    implement = await deploy(Marketplace__factory, {
      libraries: { MerkleVerifier: merkleVerifier.address },
    });
  }

  let wethAddress;
  if (hre.network.tags.test) {
    wethAddress = (await connect(WETH__factory)).address;
  } else {
    wethAddress = (weth as any)[hre.network.name.toLowerCase()];
  }

  let initializeTransaction;
  if (hre.network.tags.local) {
    initializeTransaction = await implement.contract.populateTransaction.initialize(
      hre.network.config.chainId as number,
      wethAddress,
      executionDelegateProxy.address,
      policyManager.address,
      accounts.vault.address,
      5,
    );
  } else {
    initializeTransaction = await implement.contract.populateTransaction.initialize(
      hre.network.config.chainId as number,
      wethAddress,
      executionDelegateProxy.address,
      policyManager.address,
      accounts.signer.address,
      5,
    );
  }
  const proxy = await deploy(TransparentUpgradeableProxy__factory, {
    aliasName: "MarketplaceProxy",
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
func.tags = ["marketplace"];
