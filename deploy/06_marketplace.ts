import { DeployFunction } from "hardhat-deploy/types";
import {
  ERC1967Proxy__factory,
  ExecutionDelegate__factory,
  Marketplace__factory,
  PolicyManager__factory,
  WETH__factory,
} from "../types";
import { Ship } from "../utils";
import { weth } from "../configs/weth";

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  const executionDelegate = await connect(ExecutionDelegate__factory);
  const policyManager = await connect(PolicyManager__factory);

  const implement = await connect(Marketplace__factory);

  let wethAddress;
  if (hre.network.tags.test) {
    wethAddress = (await connect(WETH__factory)).address;
  } else {
    wethAddress = (weth as any)[hre.network.name.toLowerCase()];
  }

  const initializeTransaction = await implement.populateTransaction.initialize(
    hre.network.config.chainId as number,
    wethAddress,
    executionDelegate.address,
    policyManager.address,
    accounts.vault.address,
    5,
  );
  const proxy = await deploy(ERC1967Proxy__factory, {
    aliasName: "MarketplaceProxy",
    args: [implement.address, initializeTransaction.data as string],
  });

  if (proxy.newlyDeployed) {
    const tx = await executionDelegate.approveContract(proxy.address);
    console.log("Approving proxy contract at", tx.hash);
    await tx.wait();
  }
};

export default func;
func.dependencies = ["marketplace-implement", "execution-delegate", "policy-manager", "mocks"];
func.tags = ["marketplace"];
