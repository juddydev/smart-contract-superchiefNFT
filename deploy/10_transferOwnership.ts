import { DeployFunction } from "hardhat-deploy/types";
import {
  AuctionManager__factory,
  ExecutionDelegate__factory,
  Marketplace__factory,
  PolicyManager__factory,
} from "../types";
import { Ship } from "../utils";

const receiver = "0xa7d9B93c57D6FB96a9C83A711C3d25E4212daC24";
const func: DeployFunction = async (hre) => {
  const { connect, accounts } = await Ship.init(hre);

  const executionDelegateProxy = await connect("ExecutionDelegateProxy");
  const executionDelegate = ExecutionDelegate__factory.connect(
    executionDelegateProxy.address,
    accounts.deployer,
  );
  let tx = await executionDelegate.transferOwnership(receiver);
  console.log("Transferring ownership of execution delegate at", tx.hash);
  await tx.wait();

  const marketplaceProxy = await connect("MarketplaceProxy");
  const marketplace = Marketplace__factory.connect(marketplaceProxy.address, accounts.deployer);
  tx = await marketplace.transferOwnership(receiver);
  console.log("Transferring ownership of marketplace at", tx.hash);
  await tx.wait();

  const auctionManagerProxy = await connect("AuctionManagerProxy");
  const auctionManager = AuctionManager__factory.connect(auctionManagerProxy.address, accounts.deployer);
  tx = await auctionManager.transferOwnership(receiver);
  console.log("Transferring ownership of auction manager at", tx.hash);
  await tx.wait();

  const policyManager = await connect(PolicyManager__factory);
  tx = await policyManager.transferOwnership(receiver);
  console.log("Transferring ownership of policy manager at", tx.hash);
  await tx.wait();
};

export default func;
func.tags = ["transfer-ownership"];
func.dependencies = ["execution-delegate", "marketplace", "auction-manager", "policy-manager"];
