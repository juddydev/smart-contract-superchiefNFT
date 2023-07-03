import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../utils";
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
} from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments } from "hardhat";
import { Order, Side } from "./utils/structure";
import { parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";

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

let orderInput: any;
let order: Order;
let otherOrders: Order[];
let orderHash: string;

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

describe("Signature test", () => {
  before(async () => {
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
  });

  beforeEach(async () => {
    order = generateOrder(alice);

    otherOrders = [
      generateOrder(alice, { salt: 1 }),
      generateOrder(alice, { salt: 2 }),
      generateOrder(alice, { salt: 3 }),
    ];
    orderHash = await order.hash();
    orderInput = await order.pack();
  });

  describe("personal", function () {
    beforeEach(async () => {
      order.parameters.expirationTime = (Math.floor(new Date().getTime() / 1000) + 86400).toString();
      orderHash = await order.hash();
      orderInput = await order.pack();
    });
    describe("single", function () {
      it("sent by trader no signatures", async () => {
        orderInput = await order.packNoSigs();
        expect(await marketplace.connect(alice).validateSignatures(orderInput, orderHash)).to.equal(true);
      });
      it("not sent by trader no signatures", async () => {
        orderInput = await order.packNoSigs();
        expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(false);
      });
      it("not sent by trader valid signatures", async () => {
        orderInput = await order.pack();
        expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(true);
      });
      it("different order", async () => {
        order.parameters.price = parseUnits("2");
        orderInput = await order.pack();
        expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(false);
      });
      it("different signer", async () => {
        orderInput = await order.pack({ signer: bob });
        expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(false);
      });
    });

    describe("bulk sign", function () {
      it("sent by trader no signatures", async () => {
        orderInput = await order.packNoSigs();
        expect(await marketplace.connect(alice).validateSignatures(orderInput, orderHash)).to.equal(true);
      });
      it("not sent by trader no signatures", async () => {
        orderInput = await order.packNoSigs();
        expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(false);
      });
      it("not sent by trader valid signatures", async () => {
        orderInput = await order.packBulk(otherOrders);
        expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(true);
      });
      it("different order", async () => {
        order.parameters.price = parseUnits("2");
        orderInput = await order.pack();
        expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(false);
      });
      it("different signer", async () => {
        orderInput = await order.pack({ signer: bob });
        expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(false);
      });
    });
  });

  describe("oracle", function () {
    it("happy", async () => {
      expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(true);
    });
    it("different block number", async () => {
      orderInput.blockNumber -= 1;
      expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(false);
    });
    it("different signer", async () => {
      orderInput = await order.pack({ oracle: alice });
      expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(false);
    });
    it("with bulk", async () => {
      orderInput = await order.packBulk(otherOrders);
      expect(await marketplace.validateSignatures(orderInput, orderHash)).to.equal(true);
    });
  });
});
