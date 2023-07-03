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

let order: Order;
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

describe("validate order parameters", () => {
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
    order = generateOrder(alice, { side: Side.Sell });
    orderHash = await order.hash();
  });

  it("trader is zero", async () => {
    order.parameters.trader = constants.AddressZero;
    expect(await marketplace.validateOrderParameters(order.parameters, orderHash)).to.equal(false);
  });
  it("expiration time is 0 and listing time < now", async () => {
    expect(await marketplace.validateOrderParameters(order.parameters, orderHash)).to.equal(true);
  });
  it("expiration time is 0 and listing time > now", async () => {
    order.parameters.listingTime = "10000000000000000000000000000";
    expect(await marketplace.validateOrderParameters(order.parameters, orderHash)).to.equal(false);
  });
  it("expiration time > now and listing time < now", async () => {
    order.parameters.expirationTime = "10000000000000000000000000000";
    expect(await marketplace.validateOrderParameters(order.parameters, orderHash)).to.equal(true);
  });
  it("expiration time < now and listing time < now", async () => {
    order.parameters.expirationTime = "1";
    expect(await marketplace.validateOrderParameters(order.parameters, orderHash)).to.equal(false);
  });
  it("cancelled or filled", async () => {
    await marketplace.connect(alice).cancelOrder(order.parameters);
    expect(await marketplace.validateOrderParameters(order.parameters, orderHash)).to.equal(false);
  });
});
