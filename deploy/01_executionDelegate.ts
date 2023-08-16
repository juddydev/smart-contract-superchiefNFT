import { DeployFunction } from "hardhat-deploy/types";
import { ExecutionDelegate__factory } from "../types";
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

  const executionDelegate = await deploy(ExecutionDelegate__factory, {
    args: ["0x608f3177A67Aa5A13b4B04f1230C0597356E9887"],
  });

  if (executionDelegate.newlyDeployed) {
    console.log("Execution Delegate Contract deployed");
  }
};

export default func;
func.tags = ["execution-delegate"];
