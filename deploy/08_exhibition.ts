import { DeployFunction } from "hardhat-deploy/types";
import { ERC1155Exhibition__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  const executionDelegate = await connect("ExecutionDelegateProxy");
  await deploy(ERC1155Exhibition__factory, {
    args: ["Test Exhibition", "TE", "", accounts.signer.address, executionDelegate.address],
  });
};

export default func;
func.tags = ["exhibition"];
func.dependencies = ["execution-delegate"];
