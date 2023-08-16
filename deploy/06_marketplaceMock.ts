import { DeployFunction } from "hardhat-deploy/types";
import {
  ExecutionDelegate__factory,
  MarketplaceMock__factory,
  MerkleVerifier__factory,
  PolicyManager__factory,
  WETH__factory,
  ERC1967Proxy__factory,
} from "../types";
import { Ship } from "../utils";
import { weth } from "../configs/weth";
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

  const merkleVerifier = await connect(MerkleVerifier__factory);
  const executionDelegate = await connect(ExecutionDelegate__factory);
  const policyManager = await connect(PolicyManager__factory);

  const implement = await deploy(MarketplaceMock__factory, {
    libraries: { MerkleVerifier: merkleVerifier.address },
  });
  let wethAddress;
  if (hre.network.tags.test) {
    wethAddress = (await connect(WETH__factory)).address;
  } else {
    wethAddress = (weth as any)[hre.network.name.toLowerCase()];
  }

  const initializeTransaction = await implement.contract.populateTransaction.initialize(
    hre.network.config.chainId as number,
    wethAddress,
    executionDelegate.address,
    policyManager.address,
    "0x608f3177A67Aa5A13b4B04f1230C0597356E9887",
    5,
  );
  const proxy = await deploy(ERC1967Proxy__factory, {
    aliasName: "MarketplaceMockProxy",
    args: [implement.address, initializeTransaction.data as string],
  });

  if (proxy.newlyDeployed) {
    const signature = await getSign(accounts.deployer.address, 3);
    const tx = await executionDelegate.approveContract(proxy.address, "SuperChief Marketplace", signature);
    console.log("Approving proxy contract at");
    await tx.wait();
  }
};

export default func;
func.dependencies = ["execution-delegate", "merkle-verifier", "policy-manager", "mocks"];
func.tags = ["marketplace-mock"];
