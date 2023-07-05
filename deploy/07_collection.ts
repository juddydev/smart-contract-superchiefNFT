import { DeployFunction } from "hardhat-deploy/types";
import { Collection__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy } = await Ship.init(hre);

  await deploy(Collection__factory, {
    args: ["Test", "TEST", ""]
  });
};

export default func;
func.tags = ["collection"];
