import { DeployFunction } from "hardhat-deploy/types";
import { ExecutionDelegate__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, accounts } = await Ship.init(hre);

  const executionDelegate = await deploy(ExecutionDelegate__factory);

  if (executionDelegate.newlyDeployed) {
    const tx = await executionDelegate.contract.addBaseFee(200, accounts.vault.address);
    await tx.wait();
  }
};

export default func;
func.tags = ["execution-delegate"];
