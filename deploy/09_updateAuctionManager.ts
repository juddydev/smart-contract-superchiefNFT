import { DeployFunction } from "hardhat-deploy/types";
import { AuctionManager__factory, ITransparentUpgradeableProxy } from "../types";
import { Ship } from "../utils";

const func: DeployFunction = async (hre) => {
  const { deploy, connect } = await Ship.init(hre);

  const implement = await deploy(AuctionManager__factory);

  const proxy = (await connect("AuctionManagerProxy")) as ITransparentUpgradeableProxy;

  const tx = await proxy.upgradeTo(implement.address);
  await tx.wait();
};

export default func;
func.tags = ["update-auction-manager"];
