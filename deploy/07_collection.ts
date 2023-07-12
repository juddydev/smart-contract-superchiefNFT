import { DeployFunction } from "hardhat-deploy/types";
import { Collection__factory, ExecutionDelegate__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect } = await Ship.init(hre);

  const executionDelegate = await connect(ExecutionDelegate__factory);
  await deploy(Collection__factory, {
    args: ["Test", "TEST", "", executionDelegate.address],
  });
};

export default func;
func.tags = ["collection"];
func.dependencies = ["execution-delegate"];
