import { DeployFunction } from "hardhat-deploy/types";
import { TransparentUpgradeableProxy__factory, ExecutionDelegate__factory } from "../types";
import { Ship } from "../utils";
import { arrayify, solidityKeccak256, splitSignature } from "ethers/lib/utils";
import { Signer } from "ethers";

const func: DeployFunction = async (hre) => {
  const { deploy, accounts } = await Ship.init(hre);

  const implement = await deploy(ExecutionDelegate__factory);

  const initTx = await implement.contract.populateTransaction.initialize(
    hre.network.tags.local ? accounts.signer.address : "0x608f3177A67Aa5A13b4B04f1230C0597356E9887",
  );

  await deploy(TransparentUpgradeableProxy__factory, {
    aliasName: "ExecutionDelegateProxy",
    args: [implement.address, accounts.vault.address, initTx.data as string],
  });
};

export default func;
func.tags = ["execution-delegate"];
