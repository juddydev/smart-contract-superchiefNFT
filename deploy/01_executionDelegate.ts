import { DeployFunction } from "hardhat-deploy/types";
import { AuctionManager__factory, ExecutionDelegate__factory, Marketplace__factory } from "../types";
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

  const executionDelegate = await deploy(ExecutionDelegate__factory);

  if (executionDelegate.newlyDeployed) {
    const signature = await getSign(accounts.deployer.address, 0, accounts.deployer);
    const tx = await executionDelegate.contract.addBaseFee(200, accounts.vault.address, signature);
    await tx.wait();

    // const marketplaceProxy = await connect("MarketplaceProxy");
    // const marketplace = Marketplace__factory.connect(marketplaceProxy.address, accounts.deployer);
    // const tx1 = await marketplace.setExecutionDelegate(executionDelegate.address);
    // await tx1.wait();

    // const auctionManagerProxy = await connect("AuctionManagerProxy");
    // const auctionManager = AuctionManager__factory.connect(auctionManagerProxy.address, accounts.deployer);
    // const tx2 = await auctionManager.setExecutionDelegate(executionDelegate.address);
    // await tx2.wait();
  }
};

export default func;
func.tags = ["execution-delegate"];
