import { DeployFunction } from "hardhat-deploy/types";
import { ExecutionDelegate__factory, ITransparentUpgradeableProxy } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect } = await Ship.init(hre);

  const implement = await deploy(ExecutionDelegate__factory);

  const proxy = (await connect("ExecutionDelegateProxy")) as ITransparentUpgradeableProxy;

  const tx = await proxy.upgradeTo(implement.address);
  await tx.wait();
};

export default func;
func.tags = ["update-execution-delegate"];
