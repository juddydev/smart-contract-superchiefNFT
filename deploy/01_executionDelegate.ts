import { DeployFunction } from "hardhat-deploy/types";
import { TransparentUpgradeableProxy__factory, ExecutionDelegate__factory } from "../types";
import { Ship } from "../utils";
import { arrayify, solidityKeccak256, splitSignature } from "ethers/lib/utils";
import { Signer } from "ethers";

const func: DeployFunction = async (hre) => {
  const { deploy, accounts } = await Ship.init(hre);

  const implement = await deploy(ExecutionDelegate__factory);

  const initTx = await implement.contract.populateTransaction.initialize(accounts.signer.address);

  await deploy(TransparentUpgradeableProxy__factory, {
    aliasName: "ExecutionDelegateProxy",
    args: [implement.address, accounts.vault.address, initTx.data as string],
  });
};

export default func;
func.tags = ["execution-delegate"];
