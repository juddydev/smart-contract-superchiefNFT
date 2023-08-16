import { DeployFunction } from "hardhat-deploy/types";
import { AdminUpgradeableProxy__factory, ExecutionDelegate__factory } from "../types";
import { Ship } from "../utils";
import { arrayify, solidityKeccak256, splitSignature } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

export const getSign = async (address: string, nonce: number, signer: SignerWithAddress) => {
  const hash = solidityKeccak256(["address", "uint256"], [address, nonce]);
  const signature = await signer.signMessage(arrayify(hash));

  // split signature
  const { r, s, v } = splitSignature(signature);

  return {
    r,
    s,
    v,
  };
};

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  const implement = await deploy(ExecutionDelegate__factory);

  const initTx = await implement.contract.populateTransaction.initialize();

  const proxy = await deploy(AdminUpgradeableProxy__factory, {
    aliasName: "ExecutionDelegateProxy",
    args: [implement.address, accounts.deployer.address, initTx.data as string],
  });

  if (proxy.newlyDeployed) {
    const executionDelegate = ExecutionDelegate__factory.connect(proxy.address, accounts.deployer);
    const signature = await getSign(accounts.deployer.address, 0, accounts.deployer);
    const tx = await executionDelegate.addBaseFee(
      "SuperChief Platform Fee",
      200,
      accounts.vault.address,
      signature,
    );
    await tx.wait();
  }
};

export default func;
func.tags = ["execution-delegate"];
