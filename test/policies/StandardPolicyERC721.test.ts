import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../../utils";
import {
  MarketplaceMock,
  MarketplaceMock__factory,
  MerkleVerifier__factory,
  MockERC721,
  MockERC721__factory,
  StandardPolicyERC721,
  StandardPolicyERC721__factory,
  WETH,
  WETH__factory,
} from "../../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments } from "hardhat";
import { Order, OrderParameters, Side } from "../utils/structure";
import { parseUnits } from "ethers/lib/utils";
import { BigNumber, constants } from "ethers";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let marketplace: MarketplaceMock;
let policy: StandardPolicyERC721;
let mockERC721: MockERC721;
let weth: WETH;

let deployer: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let vault: SignerWithAddress;

let sell: OrderParameters;
let buy: OrderParameters;

const tokenId = 1;
const feeRate = 300;
const price: BigNumber = parseUnits("1");

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

const generateOrder = (account: SignerWithAddress, overrides: any = {}): Order => {
  return new Order(
    account,
    {
      trader: account.address,
      side: Side.Buy,
      matchingPolicy: policy.address,
      collection: mockERC721.address,
      tokenId,
      amount: 0,
      paymentToken: weth.address,
      price,
      listingTime: "0",
      expirationTime: "0",
      fees: [
        {
          rate: feeRate,
          recipient: vault.address,
        },
      ],
      salt: 0,
      extraParams: "0x",
      ...overrides,
    },
    vault,
    marketplace,
  );
};

describe("StandardPolicyERC721 test", () => {
  beforeEach(async () => {
    const { accounts } = await setup();

    deployer = accounts.deployer;
    alice = accounts.alice;
    bob = accounts.bob;
    vault = accounts.vault;

    const proxy = await ship.connect("MarketplaceProxy");
    const merkleVerifier = await ship.connect(MerkleVerifier__factory);
    marketplace = await ship.connect(MarketplaceMock__factory, proxy.address, {
      libraries: { MerkleVerifier: merkleVerifier.address },
    });
    policy = await ship.connect(StandardPolicyERC721__factory);
    mockERC721 = await ship.connect(MockERC721__factory);
    weth = await ship.connect(WETH__factory);

    sell = generateOrder(alice, { side: Side.Sell, tokenId }).parameters;
    buy = generateOrder(bob, { side: Side.Buy, tokenId }).parameters;
  });

  describe("sell is maker", () => {
    it("should match", async () => {
      const { price, tokenId, amount } = await marketplace.canMatchOrders(sell, buy);
      expect(price).to.equal(sell.price);
      expect(tokenId).to.equal(sell.tokenId);
      expect(amount).to.equal(1);
    });
    it("should not match if orders are the same side", async () => {
      sell.side = Side.Buy;
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
    it("should not match if paymentTokens don't match", async () => {
      sell.paymentToken = constants.AddressZero;
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
    it("should not match if collections don't match", async () => {
      buy.collection = deployer.address;
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
    it("should not match if tokenIds don't match", async () => {
      buy.tokenId = tokenId + 1;
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
    it("should not match if prices don't match", async () => {
      sell.price = parseUnits("2");
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
  });

  describe("buy is maker", () => {
    beforeEach(() => {
      buy.listingTime = "1";
      sell.listingTime = "2";
    });
    it("should match", async () => {
      const { price, tokenId, amount } = await marketplace.canMatchOrders(sell, buy);
      expect(price).to.equal(sell.price);
      expect(tokenId).to.equal(sell.tokenId);
      expect(amount).to.equal(1);
    });
    it("should not match if orders are the same side", async () => {
      sell.side = Side.Buy;
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
    it("should not match if paymentTokens don't match", async () => {
      sell.paymentToken = constants.AddressZero;
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
    it("should not match if collections don't match", async () => {
      buy.collection = deployer.address;
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
    it("should not match if tokenIds don't match", async () => {
      buy.tokenId = tokenId + 1;
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
    it("should not match if prices don't match", async () => {
      sell.price = parseUnits("2");
      await expect(marketplace.canMatchOrders(sell, buy)).to.be.revertedWith("Orders cannot be matched");
    });
  });
});
