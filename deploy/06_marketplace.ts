import { DeployFunction } from "hardhat-deploy/types";
import {
  ExecutionDelegate__factory,
  MarketplaceMock__factory,
  Marketplace__factory,
  MerkleVerifier__factory,
  PolicyManager__factory,
  WETH__factory,
} from "../types";
import { Ship } from "../utils";
import { weth } from "../configs/weth";
import { ERC1967Proxy__factory } from "./../types/factories/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy__factory";

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  const merkleVerifier = await connect(MerkleVerifier__factory);
  const executionDelegate = await connect(ExecutionDelegate__factory);
  const policyManager = await connect(PolicyManager__factory);

  let implement;

  if (hre.network.tags.local) {
    implement = await deploy(MarketplaceMock__factory, {
      aliasName: "Marketplace",
      libraries: { MerkleVerifier: merkleVerifier.address },
    });
  } else {
    implement = await deploy(Marketplace__factory, {
      libraries: { MerkleVerifier: merkleVerifier.address },
    });
  }

  let wethAddress;
  if (hre.network.tags.test) {
    wethAddress = (await connect(WETH__factory)).address;
  } else {
    wethAddress = (weth as any)[hre.network.name.toLowerCase()];
  }

  let initializeTransaction;
  if (hre.network.tags.local) {
    initializeTransaction = await implement.contract.populateTransaction.initialize(
      hre.network.config.chainId as number,
      wethAddress,
      executionDelegate.address,
      policyManager.address,
      accounts.vault.address,
      5,
    );
  } else {
    initializeTransaction = await implement.contract.populateTransaction.initialize(
      hre.network.config.chainId as number,
      wethAddress,
      executionDelegate.address,
      policyManager.address,
      "0x608f3177A67Aa5A13b4B04f1230C0597356E9887",
      5,
    );
  }
  const proxy = await deploy(ERC1967Proxy__factory, {
    aliasName: "MarketplaceProxy",
    args: [implement.address, initializeTransaction.data as string],
  });

  if (proxy.newlyDeployed) {
    const tx = await executionDelegate.approveContract(proxy.address);
    console.log("Approving proxy contract at", tx.hash);
    await tx.wait();
  }
};

export default func;
func.dependencies = ["execution-delegate", "merkle-verifier", "policy-manager", "mocks"];
func.tags = ["marketplace"];
