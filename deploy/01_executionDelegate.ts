import { DeployFunction } from "hardhat-deploy/types";
import { ExecutionDelegate__factory } from "../types";
import { Ship } from "../utils";
import { arrayify, solidityKeccak256, splitSignature } from "ethers/lib/utils";
import { ethers } from "hardhat";

export const getSign = async (address: string, nonce: number) => {
  const signer = new ethers.Wallet(process.env.SIGNER_PRIV_KEY as string);
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

  const executionDelegate = await deploy(ExecutionDelegate__factory, {
    args: ["0x608f3177A67Aa5A13b4B04f1230C0597356E9887"],
  });

  if (executionDelegate.newlyDeployed) {
    const signature = await getSign(accounts.deployer.address, 0);
    const tx = await executionDelegate.contract.addBaseFee(
      "SuperChief Platform Fee",
      500,
      accounts.vault.address,
      signature,
    );
    await tx.wait();

    const signature1 = await getSign(accounts.deployer.address, 1);
    const tx1 = await executionDelegate.contract.addBaseFee(
      "Artist Foundation Fee",
      500,
      accounts.vault.address,
      signature1,
    );
    await tx1.wait();

    console.log("Execution Delegate Contract deployed");
  }
};

export default func;
func.tags = ["execution-delegate"];
