import { DeployFunction } from "hardhat-deploy/types";
import { MerkleVerifier__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy } = await Ship.init(hre);

  await deploy(MerkleVerifier__factory);
};

export default func;
func.tags = ["merkle-verifier"];
