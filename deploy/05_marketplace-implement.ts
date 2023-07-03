import { DeployFunction } from "hardhat-deploy/types";
import { MarketplaceMock__factory, Marketplace__factory, MerkleVerifier__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect } = await Ship.init(hre);

  const merkleVerifier = await connect(MerkleVerifier__factory);
  if (hre.network.tags.local) {
    await deploy(MarketplaceMock__factory, {
      aliasName: "Marketplace",
      libraries: { MerkleVerifier: merkleVerifier.address },
    });
  } else {
    await deploy(Marketplace__factory, {
      libraries: { MerkleVerifier: merkleVerifier.address },
    });
  }
};

export default func;
func.tags = ["marketplace-implement"];
func.dependencies = ["merkle-verifier"];
