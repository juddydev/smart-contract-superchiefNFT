import { DeployFunction } from "hardhat-deploy/types";
import {
  PolicyManager__factory,
  StandardPolicyERC1155__factory,
  StandardPolicyERC721__factory,
} from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect } = await Ship.init(hre);

  const policyManager = await connect(PolicyManager__factory);

  const standardPolicyERC721 = await deploy(StandardPolicyERC721__factory);
  const standardPolicyERC1155 = await deploy(StandardPolicyERC1155__factory);

  if (standardPolicyERC721.newlyDeployed) {
    const tx = await policyManager.addPolicy(standardPolicyERC721.address);
    console.log("Adding ERC721 policy at", tx.hash);
    await tx.wait();
  }
  if (standardPolicyERC1155.newlyDeployed) {
    const tx = await policyManager.addPolicy(standardPolicyERC1155.address);
    console.log("Adding ERC1155 policy at", tx.hash);
    await tx.wait();
  }
};

export default func;
func.dependencies = ["policy-manager"];
func.tags = ["policies"];
