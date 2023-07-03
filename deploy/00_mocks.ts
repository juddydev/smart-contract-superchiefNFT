import { DeployFunction } from "hardhat-deploy/types";
import { MockERC1155__factory, MockERC20__factory, MockERC721__factory, WETH__factory } from "../types";
import { Ship } from "../utils";
import { parseUnits } from "ethers/lib/utils";

const func: DeployFunction = async (hre) => {
  const { deploy, accounts } = await Ship.init(hre);

  if (hre.network.tags.test) {
    await deploy(MockERC20__factory);
    await deploy(MockERC1155__factory);
    await deploy(MockERC721__factory);
    const weth = await deploy(WETH__factory);

    if (hre.network.tags.local) {
      let tx = await weth.contract.connect(accounts.alice).mint(parseUnits("1000"));
      await tx.wait();
      tx = await weth.contract.connect(accounts.bob).mint(parseUnits("1000"));
      await tx.wait();
    }
  }
};

export default func;
func.tags = ["mocks"];
