import { DeployFunction } from "hardhat-deploy/types";
import { AuctionManager__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy } = await Ship.init(hre);

  await deploy(AuctionManager__factory);
};

export default func;
func.tags = ["auction-manager"];
