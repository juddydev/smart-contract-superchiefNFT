import { DeployFunction } from "hardhat-deploy/types";
import { PolicyManager__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy } = await Ship.init(hre);

  await deploy(PolicyManager__factory);
};

export default func;
func.tags = ["policy-manager"];
