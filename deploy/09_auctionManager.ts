import { DeployFunction } from "hardhat-deploy/types";
import {
  TransparentUpgradeableProxy__factory,
  AuctionManager__factory,
  IExecutionDelegate__factory,
} from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  const executionDelegateProxy = await connect("ExecutionDelegateProxy");

  const implement = await deploy(AuctionManager__factory);

  const initializeTransaction = await implement.contract.populateTransaction.initialize(
    executionDelegateProxy.address,
  );

  const proxy = await deploy(TransparentUpgradeableProxy__factory, {
    aliasName: "AuctionManagerProxy",
    args: [implement.address, accounts.vault.address, initializeTransaction.data as string],
  });

  if (proxy.newlyDeployed && hre.network.tags.local) {
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
func.dependencies = ["execution-delegate"];
func.tags = ["auction-manager"];
