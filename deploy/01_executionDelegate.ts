import { DeployFunction } from "hardhat-deploy/types";
import { ExecutionDelegate__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy } = await Ship.init(hre);

  await deploy(ExecutionDelegate__factory);
};

export default func;
func.tags = ["execution-delegate"];
