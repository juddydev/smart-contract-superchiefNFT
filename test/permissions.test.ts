import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../utils";
import {
  Marketplace,
  Marketplace__factory,
  MerkleVerifier__factory,
  MockERC721,
  MockERC721__factory,
  StandardPolicyERC721,
  StandardPolicyERC721__factory,
  WETH,
  WETH__factory,
} from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments } from "hardhat";
import { constants } from "ethers";
import { assertPublicMutableMethods } from "./utils";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let marketplace: Marketplace;
let policy: StandardPolicyERC721;
let mockERC721: MockERC721;
let weth: WETH;

let deployer: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let vault: SignerWithAddress;

const setup = deployments.createFixture(async (hre) => {
  ship = await Ship.init(hre);
  const { accounts, users } = ship;
  await deployments.fixture(["marketplace", "policies"]);

  return {
    ship,
    accounts,
    users,
  };
});

const order =
  "(address,uint8,address,address,uint256,uint256,address,uint256,uint256,uint256,(uint16,address)[],uint256,bytes)";
const publicMutableMethods = [
  "initialize(uint256,address,address,address,address,uint256)",
  "transferOwnership(address)",
  "renounceOwnership()",
  "close()",
  "open()",
  "setOracle(address)",
  "setBlockRange(uint256)",
  "setExecutionDelegate(address)",
  "setPolicyManager(address)",
  `cancelOrder(${order})`,
  `cancelOrders(${order}[])`,
  `incrementNonce()`,
  `execute((${order},uint8,bytes32,bytes32,bytes,uint8,uint256),(${order},uint8,bytes32,bytes32,bytes,uint8,uint256))`,
  "upgradeTo(address)",
  "upgradeToAndCall(address,bytes)",
  "updateBaseFee((uint16,address)[])",
  "clearBaseFee()",
  "addBaseFee(uint16,address)",
];

describe("Permissions test", () => {
  before(async () => {
    const { accounts } = await setup();

    deployer = accounts.deployer;
    alice = accounts.alice;
    bob = accounts.bob;
    vault = accounts.vault;

    const proxy = await ship.connect("MarketplaceProxy");
    const merkleVerifier = await ship.connect(MerkleVerifier__factory);
    marketplace = await ship.connect(Marketplace__factory, proxy.address, {
      libraries: { MerkleVerifier: merkleVerifier.address },
    });
    policy = await ship.connect(StandardPolicyERC721__factory);
    mockERC721 = await ship.connect(MockERC721__factory);
    weth = await ship.connect(WETH__factory);
  });

  it("has correct public interface", async () => {
    await assertPublicMutableMethods(marketplace, publicMutableMethods);
  });

  const setAddress = async (fnName: string) => {
    it("can be called by owner", async () => {
      await (marketplace as any)[fnName](vault.address);
    });
    it("reverts when not called by owner", async () => {
      await expect((marketplace as any).connect(alice)[fnName](vault.address)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
    it("reverts when address is 0", async () => {
      await expect((marketplace as any)[fnName](constants.AddressZero)).to.be.revertedWith(
        "Address cannot be zero",
      );
    });
  };

  describe("setOracle", async () => setAddress("setOracle"));
  describe("setExecutionDelegate", async () => setAddress("setExecutionDelegate"));
  describe("setPolicyManager", async () => setAddress("setPolicyManager"));

  describe("setBlockRange", async () => {
    it("can be called by owner", async () => {
      await marketplace.setBlockRange(5);
    });
    it("reverts when not called by owner", async () => {
      await expect(marketplace.connect(alice).setBlockRange(5)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });
  });

  describe("close", async () => {
    it("can be called by owner", async () => {
      await marketplace.close();
    });
    it("reverts when not called by owner", async () => {
      await expect(marketplace.connect(alice).close()).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  describe("open", async () => {
    it("can be called by owner", async () => {
      await marketplace.open();
    });
    it("reverts when not called by owner", async () => {
      await expect(marketplace.connect(alice).open()).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
