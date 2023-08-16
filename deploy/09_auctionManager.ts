import { DeployFunction } from "hardhat-deploy/types";
import { AuctionManager__factory, ERC1967Proxy__factory, ExecutionDelegate__factory } from "../types";
import { Ship } from "../utils";
import { ethers } from "hardhat";
import { arrayify, solidityKeccak256, splitSignature } from "ethers/lib/utils";

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

  const executionDelegate = await connect(ExecutionDelegate__factory);

  const implement = await deploy(AuctionManager__factory);

  const initializeTransaction = await implement.contract.populateTransaction.initialize(
    executionDelegate.address,
  );

  const proxy = await deploy(ERC1967Proxy__factory, {
    aliasName: "AuctionManagerProxy",
    args: [implement.address, initializeTransaction.data as string],
  });

  if (proxy.newlyDeployed) {
    const signature = await getSign(accounts.deployer.address, 4);
    const tx = await executionDelegate.approveContract(proxy.address, "Auction Manager Contract", signature);
    console.log("Approving proxy contract at");
    await tx.wait();
  }
};

export default func;
func.dependencies = ["execution-delegate"];
func.tags = ["auction-manager"];
