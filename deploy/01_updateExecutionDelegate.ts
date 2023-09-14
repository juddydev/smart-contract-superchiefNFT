import { DeployFunction } from "hardhat-deploy/types";
import {
  ExecutionDelegate__factory,
  IExecutionDelegate__factory,
  ITransparentUpgradeableProxy__factory,
} from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  const implement = await deploy(ExecutionDelegate__factory);

  const proxy = await connect("ExecutionDelegateProxy");
  let contract;
  if (hre.network.tags.test) {
    contract = ITransparentUpgradeableProxy__factory.connect(proxy.address, accounts.bob);
  } else {
    contract = ITransparentUpgradeableProxy__factory.connect(proxy.address, accounts.vault);
  }

  const tx = await contract.upgradeTo(implement.address);
  await tx.wait();
};

export default func;
func.tags = ["update-execution-delegate"];
