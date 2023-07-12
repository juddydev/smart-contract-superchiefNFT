import { deployments } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship, advanceBlockTo, advanceTimeAndBlock } from "../utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  AuctionManager,
  AuctionManager__factory,
  ExecutionDelegate,
  ExecutionDelegate__factory,
  MockERC20,
  MockERC20__factory,
  MockERC721,
  MockERC721__factory,
} from "../types";
import { parseUnits, solidityKeccak256 } from "ethers/lib/utils";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let nft: MockERC721;
let token: MockERC20;
let auctionManager: AuctionManager;
let executionDelegate: ExecutionDelegate;

let deployer: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;

let auctionId: string;

const setup = deployments.createFixture(async (hre) => {
  ship = await Ship.init(hre);
  const { accounts, users } = ship;
  await deployments.fixture(["mocks", "auction-manager"]);

  return {
    ship,
    accounts,
    users,
  };
});

describe("AuctionManager test", () => {
  before(async () => {
    const { accounts } = await setup();

    deployer = accounts.deployer;
    alice = accounts.alice;
    bob = accounts.bob;

    nft = await ship.connect(MockERC721__factory);
    token = await ship.connect(MockERC20__factory);
    executionDelegate = await ship.connect(ExecutionDelegate__factory);
    const proxy = await ship.connect("AuctionManagerProxy");
    auctionManager = await ship.connect(AuctionManager__factory, proxy.address);

    await nft.mint(deployer.address, 1);
    await nft.approve(executionDelegate.address, 1);

    // distribute tokens to do test
    await token.connect(deployer).transfer(alice.address, parseUnits("10"));
    await token.connect(deployer).transfer(bob.address, parseUnits("10"));

    // approve tokens to auction contract
    await token.connect(deployer).approve(auctionManager.address, parseUnits("100"));
    await token.connect(alice).approve(auctionManager.address, parseUnits("100"));
    await token.connect(bob).approve(auctionManager.address, parseUnits("100"));
  });

  it("start auction", async () => {
    await advanceBlockTo(99);

    auctionId = solidityKeccak256(
      ["address", "address", "uint256", "address", "uint256", "uint256"],
      [deployer.address, nft.address, 1, token.address, parseUnits("1"), 100],
    );
    await expect(
      auctionManager.createAuction(nft.address, 1, token.address, parseUnits("1"), 24 * 60 * 60),
    ).to.emit(auctionManager, "AuctionStarted");

    const auctionData = await auctionManager.auctions(auctionId);
    expect(auctionData.assetType).to.eq(0);
    expect(auctionData.collection).to.eq(nft.address);
    expect(auctionData.tokenId).to.eq(1);
    expect(auctionData.paymentToken).to.eq(token.address);
    expect(auctionData.minPrice).to.eq(parseUnits("1"));
    expect(auctionData.owner).eq(deployer.address);

    expect(await nft.ownerOf(1)).to.eq(auctionManager.address);
  });

  it("bids", async () => {
    await expect(auctionManager.connect(alice).bid(auctionId, parseUnits("0.5"))).to.revertedWith(
      "Auction: bid price is low than minimum price",
    );

    await expect(auctionManager.connect(alice).bid(auctionId, parseUnits("1")))
      .to.emit(token, "Transfer")
      .withArgs(alice.address, auctionManager.address, parseUnits("1"))
      .to.emit(auctionManager, "NewBid")
      .withArgs(auctionId, alice.address, parseUnits("1"));

    expect((await auctionManager.auctions(auctionId)).bidPrice).to.eq(parseUnits("1"));
    expect((await auctionManager.auctions(auctionId)).lastBidder).to.eq(alice.address);
    expect(await token.balanceOf(auctionManager.address)).to.eq(parseUnits("1"));

    await expect(auctionManager.connect(bob).bid(auctionId, parseUnits("1"))).to.revertedWith(
      "Auction: bid price is low than last one",
    );

    await expect(auctionManager.connect(bob).bid(auctionId, parseUnits("1.5")))
      .to.emit(token, "Transfer")
      .withArgs(bob.address, auctionManager.address, parseUnits("1.5"))
      .to.emit(auctionManager, "NewBid")
      .withArgs(auctionId, bob.address, parseUnits("1.5"));

    expect((await auctionManager.auctions(auctionId)).bidPrice).to.eq(parseUnits("1.5"));
    expect((await auctionManager.auctions(auctionId)).lastBidder).to.eq(bob.address);
    expect(await token.balanceOf(auctionManager.address)).to.eq(parseUnits("1.5"));
  });

  it("finish auction", async () => {
    await expect(auctionManager.finish(auctionId)).to.revertedWith("Auction: auction not finished");

    await advanceTimeAndBlock(24 * 60 * 60);
    await expect(auctionManager.connect(alice).finish(auctionId)).to.revertedWith(
      "Auction: don't have permission to finish",
    );

    await expect(auctionManager.connect(bob).finish(auctionId))
      .to.emit(auctionManager, "Finished")
      .withArgs(auctionId, bob.address, parseUnits("1.5"));
  });
});
