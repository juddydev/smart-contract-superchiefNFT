import { DeployFunction } from "hardhat-deploy/types";
import {
  TransparentUpgradeableProxy__factory,
  AuctionManager__factory,
  ExecutionDelegate__factory,
  IExecutionDelegate__factory,
} from "../types";
import { Ship } from "../utils";
import { arrayify, solidityKeccak256, splitSignature } from "ethers/lib/utils";
import { Signer } from "ethers";

export const getSign = async (address: string, nonce: number, signer: Signer) => {
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

  const executionDelegateProxy = await connect("ExecutionDelegateProxy");

  const implement = await deploy(AuctionManager__factory);

  const initializeTransaction = await implement.contract.populateTransaction.initialize(
    executionDelegateProxy.address,
  );

  const proxy = await deploy(TransparentUpgradeableProxy__factory, {
    aliasName: "AuctionManagerProxy",
    args: [implement.address, accounts.vault.address, initializeTransaction.data as string],
  });

  if (proxy.newlyDeployed && hre.network.tags.local) {
    const signature = await getSign(accounts.deployer.address, 4, accounts.deployer);
    const executionDelegate = IExecutionDelegate__factory.connect(
      executionDelegateProxy.address,
      accounts.deployer,
    );
    const tx = await executionDelegate.approveContract(proxy.address, "Auction Manager Contract", signature);
    console.log("Approving proxy contract at");
    await tx.wait();
  }
};

export default func;
func.dependencies = ["execution-delegate"];
func.tags = ["auction-manager"];
