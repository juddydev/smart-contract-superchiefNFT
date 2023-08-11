import { DeployFunction } from "hardhat-deploy/types";
import { AuctionManager__factory, ERC1967Proxy__factory, ExecutionDelegate__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect } = await Ship.init(hre);

  const executionDelegate = await connect(ExecutionDelegate__factory);

  const implement = await deploy(AuctionManager__factory);

  const initializeTransaction = await implement.contract.populateTransaction.initialize(
    executionDelegate.address,
  );

  await deploy(ERC1967Proxy__factory, {
    aliasName: "AuctionManagerProxy",
    args: [implement.address, initializeTransaction.data as string],
  });
};

export default func;
func.dependencies = ["execution-delegate"];
func.tags = ["auction-manager"];
