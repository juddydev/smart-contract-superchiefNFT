import { DeployFunction } from "hardhat-deploy/types";
import { Exhibition__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, accounts } = await Ship.init(hre);

  await deploy(Exhibition__factory, {
    args: ["Test Exhibition", "TE", "", accounts.signer.address],
  });
};

export default func;
func.tags = ["exhibition"];
