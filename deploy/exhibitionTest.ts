import { DeployFunction } from "hardhat-deploy/types";
import { ERC721Exhibition__factory } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { connect, accounts } = await Ship.init(hre);

  const executionDelegate = await connect("ExecutionDelegateProxy");
  const exhibition = ERC721Exhibition__factory.connect(
    "0xf87C09B71d7b333EDEd9bA5ee67Ddcc6BeDF4b9A",
    accounts.deployer,
  );
  console.log(await exhibition.callStatic.signer(), accounts.signer.address);
  console.log(await exhibition.callStatic.executionDelegate(), executionDelegate.address);
};

export default func;
func.tags = ["exhibition-test"];
