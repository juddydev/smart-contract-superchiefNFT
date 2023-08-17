import { DeployFunction } from "hardhat-deploy/types";
import {
  Marketplace__factory,
  ITransparentUpgradeableProxy__factory,
  MerkleVerifier__factory,
} from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect, accounts } = await Ship.init(hre);

  const merkleVerifier = await connect(MerkleVerifier__factory);
  const implement = await deploy(Marketplace__factory, {
    libraries: { MerkleVerifier: merkleVerifier.address },
  });

  const proxy = await connect("MarketplaceProxy");
  const contract = ITransparentUpgradeableProxy__factory.connect(proxy.address, accounts.vault);

  const tx = await contract.upgradeTo(implement.address);
  await tx.wait();
};

export default func;
func.tags = ["update-marketplace"];
