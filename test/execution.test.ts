import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../utils";
import {
  ExecutionDelegate,
  Marketplace,
  Marketplace__factory,
  MerkleVerifier__factory,
  MockERC721,
  MockERC721__factory,
  MockERC1155,
  StandardPolicyERC721,
  StandardPolicyERC721__factory,
  WETH,
  WETH__factory,
  ExecutionDelegate__factory,
  MockERC1155__factory,
  StandardPolicyERC1155,
  StandardPolicyERC1155__factory,
} from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments } from "hardhat";
import { Order, Side } from "./utils/structure";
import { parseUnits } from "ethers/lib/utils";
import { BigNumber, constants } from "ethers";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let marketplace: Marketplace;
let executionDelegate: ExecutionDelegate;
let policy: StandardPolicyERC721;
let standardPolicyERC1155: StandardPolicyERC1155;
let mockERC721: MockERC721;
let mockERC1155: MockERC1155;
let weth: WETH;

let thirdParty: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let vault: SignerWithAddress;

const feeRate = 300;
const price: BigNumber = parseUnits("1");
const INVERSE_BASIS_POINT = 10000;

let sell: Order;
let sellInput: any;
let buy: Order;
let buyInput: any;
let otherOrders: Order[];
let fee: BigNumber;
let priceMinusFee: BigNumber;
let tokenId = 0;

let aliceBalance: BigNumber;
let aliceBalanceWeth: BigNumber;
let bobBalance: BigNumber;
let bobBalanceWeth: BigNumber;
let feeRecipientBalance: BigNumber;
let feeRecipientBalanceWeth: BigNumber;

const updateBalances = async () => {
  aliceBalance = await alice.getBalance();
  aliceBalanceWeth = await weth.balanceOf(alice.address);
  bobBalance = await bob.getBalance();
  bobBalanceWeth = await weth.balanceOf(bob.address);
  feeRecipientBalance = await thirdParty.getBalance();
  feeRecipientBalanceWeth = await weth.balanceOf(thirdParty.address);
};

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
          recipient: thirdParty.address,
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

const checkBalances = async (
  aliceEth: any,
  aliceWeth: any,
  bobEth: any,
  bobWeth: any,
  feeRecipientEth: any,
  feeRecipientWeth: any,
) => {
  expect(await alice.getBalance()).to.be.equal(aliceEth);
  expect(await weth.balanceOf(alice.address)).to.be.equal(aliceWeth);
  expect(await bob.getBalance()).to.be.equal(bobEth);
  expect(await weth.balanceOf(bob.address)).to.be.equal(bobWeth);
  expect(await thirdParty.getBalance()).to.be.equal(feeRecipientEth);
  expect(await weth.balanceOf(thirdParty.address)).to.be.equal(feeRecipientWeth);
};

describe("Execution test", () => {
  before(async () => {
    const { accounts, users } = await setup();

    thirdParty = users[0];
    alice = accounts.alice;
    bob = accounts.bob;
    vault = accounts.vault;

    const proxy = await ship.connect("MarketplaceProxy");
    const merkleVerifier = await ship.connect(MerkleVerifier__factory);
    marketplace = await ship.connect(Marketplace__factory, proxy.address, {
      libraries: { MerkleVerifier: merkleVerifier.address },
    });
    executionDelegate = await ship.connect(ExecutionDelegate__factory);
    policy = await ship.connect(StandardPolicyERC721__factory);
    mockERC721 = await ship.connect(MockERC721__factory);
    mockERC1155 = await ship.connect(MockERC1155__factory);
    standardPolicyERC1155 = await ship.connect(StandardPolicyERC1155__factory);
    weth = await ship.connect(WETH__factory);

    await mockERC721.connect(alice).setApprovalForAll(executionDelegate.address, true);
    await mockERC721.connect(bob).setApprovalForAll(executionDelegate.address, true);
    await mockERC1155.connect(alice).setApprovalForAll(executionDelegate.address, true);
    await mockERC1155.connect(bob).setApprovalForAll(executionDelegate.address, true);
    await weth.connect(alice).approve(executionDelegate.address, parseUnits("1000"));
    await weth.connect(bob).approve(executionDelegate.address, parseUnits("1000"));
  });

  beforeEach(async () => {
    await updateBalances();
    tokenId += 1;
    await mockERC721.mint(alice.address, tokenId);

    fee = price.mul(feeRate).div(INVERSE_BASIS_POINT);
    priceMinusFee = price.sub(fee);

    sell = generateOrder(alice, {
      side: Side.Sell,
      tokenId,
    });

    buy = generateOrder(bob, { side: Side.Buy, tokenId });

    otherOrders = [
      generateOrder(alice, { salt: 1 }),
      generateOrder(alice, { salt: 2 }),
      generateOrder(alice, { salt: 3 }),
    ];

    sellInput = await sell.pack();
    buyInput = await buy.pack();
  });

  it("can transfer ERC1155", async () => {
    await mockERC1155.mint(alice.address, tokenId, 1);
    sell = generateOrder(alice, {
      side: Side.Sell,
      tokenId,
      amount: 1,
      collection: mockERC1155.address,
      matchingPolicy: standardPolicyERC1155.address,
    });
    buy = generateOrder(bob, {
      side: Side.Buy,
      tokenId,
      amount: 1,
      collection: mockERC1155.address,
      matchingPolicy: standardPolicyERC1155.address,
    });
    sellInput = await sell.pack();
    buyInput = await buy.pack();

    await marketplace.execute(sellInput, buyInput);

    expect(await mockERC1155.balanceOf(bob.address, tokenId)).to.be.equal(1);
    await checkBalances(
      aliceBalance,
      aliceBalanceWeth.add(priceMinusFee),
      bobBalance,
      bobBalanceWeth.sub(price),
      feeRecipientBalance,
      feeRecipientBalanceWeth.add(fee),
    );
  });
  it("should revert with ERC20 not WETH", async () => {
    sell.parameters.paymentToken = mockERC721.address;
    buy.parameters.paymentToken = mockERC721.address;
    sellInput = await sell.pack();
    buyInput = await buy.packNoSigs();

    await expect(marketplace.connect(bob).execute(sellInput, buyInput)).to.be.revertedWith(
      "Invalid payment token",
    );
  });
  it("should revert if Exchange is not approved by ExecutionDelegate", async () => {
    await executionDelegate.denyContract(marketplace.address);

    buyInput = await buy.packNoSigs();

    await expect(marketplace.connect(bob).execute(sellInput, buyInput)).to.be.revertedWith(
      "Contract is not approved to make transfers",
    );
    await executionDelegate.approveContract(marketplace.address, "Marketplace");
  });
  it("should succeed is approval is given", async () => {
    await executionDelegate.approveContract(marketplace.address, "Marketplace");
    buyInput = await buy.packNoSigs();
    const tx = await marketplace.connect(bob).execute(sellInput, buyInput);
    const receipt = await tx.wait();
    const gasFee = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(bob.address);
    await checkBalances(
      aliceBalance,
      aliceBalanceWeth.add(priceMinusFee),
      bobBalance.sub(gasFee),
      bobBalanceWeth.sub(price),
      feeRecipientBalance,
      feeRecipientBalanceWeth.add(fee),
    );
  });
  it("should revert if user revokes approval from ExecutionDelegate", async () => {
    await executionDelegate.connect(alice).revokeApproval();
    await expect(marketplace.connect(bob).execute(sellInput, buyInput)).to.be.revertedWith(
      "User has revoked approval",
    );
    await executionDelegate.approveContract(marketplace.address, "Marketplace");
  });
  it("should succeed if user grants approval to ExecutionDelegate", async () => {
    await executionDelegate.connect(alice).grantApproval();
    await updateBalances();
    const tx = await marketplace.connect(bob).execute(sellInput, buyInput);
    const receipt = await tx.wait();
    const gasFee = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(bob.address);
    await checkBalances(
      aliceBalance,
      aliceBalanceWeth.add(priceMinusFee),
      bobBalance.sub(gasFee),
      bobBalanceWeth.sub(price),
      feeRecipientBalance,
      feeRecipientBalanceWeth.add(fee),
    );
  });
  it("buyer sends tx with ETH", async () => {
    sell.parameters.paymentToken = constants.AddressZero;
    buy.parameters.paymentToken = constants.AddressZero;
    sellInput = await sell.pack();
    buyInput = await buy.packNoSigs();

    const tx = await marketplace.connect(bob).execute(sellInput, buyInput, { value: price });
    const receipt = await tx.wait();
    const gasFee = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(bob.address);
    await checkBalances(
      aliceBalance.add(priceMinusFee),
      aliceBalanceWeth,
      bobBalance.sub(price).sub(gasFee),
      bobBalanceWeth,
      feeRecipientBalance.add(fee),
      feeRecipientBalanceWeth,
    );
  });
  it("buyer sends tx with WETH", async () => {
    buyInput = await buy.packNoSigs();
    const tx = await marketplace.connect(bob).execute(sellInput, buyInput);
    const receipt = await tx.wait();
    const gasFee = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(bob.address);
    await checkBalances(
      aliceBalance,
      aliceBalanceWeth.add(priceMinusFee),
      bobBalance.sub(gasFee),
      bobBalanceWeth.sub(price),
      feeRecipientBalance,
      feeRecipientBalanceWeth.add(fee),
    );
  });
  it("seller tx fails with ETH", async () => {
    sell.parameters.paymentToken = constants.AddressZero;
    buy.parameters.paymentToken = constants.AddressZero;
    sellInput = await sell.packNoSigs();
    buyInput = await buy.pack();

    await expect(marketplace.connect(alice).execute(sellInput, buyInput)).to.be.reverted;
  });
  it("seller sends tx with WETH", async () => {
    sellInput = await sell.packNoSigs();

    const tx = await marketplace.connect(alice).execute(sellInput, buyInput);
    const receipt = await tx.wait();
    const gasFee = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(bob.address);
    await checkBalances(
      aliceBalance.sub(gasFee),
      aliceBalanceWeth.add(priceMinusFee),
      bobBalance,
      bobBalanceWeth.sub(price),
      feeRecipientBalance,
      feeRecipientBalanceWeth.add(fee),
    );
  });
  it("random tx fails with ETH", async () => {
    sell.parameters.paymentToken = constants.AddressZero;
    buy.parameters.paymentToken = constants.AddressZero;
    sellInput = await sell.pack();
    buyInput = await buy.pack();

    await expect(marketplace.execute(sellInput, buyInput)).to.be.reverted;
  });
  it("random sends tx with WETH", async () => {
    await marketplace.execute(sellInput, buyInput);

    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(bob.address);
    await checkBalances(
      aliceBalance,
      aliceBalanceWeth.add(priceMinusFee),
      bobBalance,
      bobBalanceWeth.sub(price),
      feeRecipientBalance,
      feeRecipientBalanceWeth.add(fee),
    );
  });
  it("should revert if seller doesn't own token", async () => {
    await mockERC721.connect(alice).transferFrom(alice.address, bob.address, tokenId);
    await expect(marketplace.execute(sellInput, buyInput)).to.be.reverted;
  });
  it("can cancel order", async () => {
    await marketplace.connect(bob).cancelOrder(buy.parameters);
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Buy has invalid parameters");
  });
  it("can cancel bulk listing", async () => {
    sellInput = await sell.packBulk(otherOrders);
    await marketplace.connect(alice).cancelOrder(sell.parameters);
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Sell has invalid parameters");
  });
  it("can cancel multiple orders", async () => {
    const buy2 = generateOrder(bob, { side: Side.Buy, tokenId });
    const buyInput2 = await buy2.pack();
    await marketplace.connect(bob).cancelOrders([buy.parameters, buy2.parameters]);
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Buy has invalid parameters");
    await expect(marketplace.execute(sellInput, buyInput2)).to.be.revertedWith("Buy has invalid parameters");
  });
  it("should not cancel if not user", async () => {
    await expect(marketplace.connect(alice).cancelOrder(buy.parameters)).to.be.reverted;
  });
  it("should not match with invalid parameters sell", async () => {
    await marketplace.connect(bob).cancelOrder(buy.parameters);
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Buy has invalid parameters");
  });
  it("should not match with invalid parameters buy", async () => {
    await marketplace.connect(bob).cancelOrder(buy.parameters);
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Buy has invalid parameters");
  });
  it("should not match with invalid signatures sell", async () => {
    sellInput = await sell.pack({ signer: bob });
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Sell failed authorization");
  });
  it("should not match with invalid signatures buy", async () => {
    buyInput = await buy.pack({ signer: alice });
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Buy failed authorization");
  });
  it("should revert if orders cannot be matched", async () => {
    sell.parameters.price = BigNumber.from("1");
    sellInput = await sell.pack();

    await expect(marketplace.connect(bob).execute(sellInput, buyInput)).to.be.revertedWith(
      "Orders cannot be matched",
    );
  });
  it("should revert policy is not whitelisted", async () => {
    sell.parameters.matchingPolicy = constants.AddressZero;
    buy.parameters.matchingPolicy = constants.AddressZero;
    sellInput = await sell.pack();
    buyInput = await buy.packNoSigs();

    await expect(marketplace.connect(bob).execute(sellInput, buyInput)).to.be.revertedWith(
      "Policy is not whitelisted",
    );
  });
  it("should revert if buyer has insufficient funds ETH", async () => {
    sell.parameters.paymentToken = constants.AddressZero;
    buy.parameters.paymentToken = constants.AddressZero;
    sellInput = await sell.pack();
    buyInput = await buy.packNoSigs();

    await expect(marketplace.connect(bob).execute(sellInput, buyInput)).to.be.reverted;
  });
  it("should revert if buyer has insufficient funds WETH", async () => {
    sell.parameters.price = BigNumber.from("10000000000000000000000000000");
    buy.parameters.price = BigNumber.from("10000000000000000000000000000");
    sellInput = await sell.pack();
    buyInput = await buy.packNoSigs();

    await expect(marketplace.connect(bob).execute(sellInput, buyInput)).to.be.reverted;
  });
  it("should revert if fee rates exceed 10000", async () => {
    sell.parameters.fees.push({ rate: 9701, recipient: thirdParty.address });
    sellInput = await sell.pack();

    await expect(marketplace.connect(bob).execute(sellInput, buyInput)).to.be.reverted;
  });
  it("cancel all previous orders and match with new nonce", async () => {
    await marketplace.connect(alice).incrementNonce();
    await marketplace.connect(bob).incrementNonce();
    sellInput = await sell.pack();
    buyInput = await buy.pack();

    await updateBalances();

    await marketplace.execute(sellInput, buyInput);

    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(bob.address);
    await checkBalances(
      aliceBalance,
      aliceBalanceWeth.add(priceMinusFee),
      bobBalance,
      bobBalanceWeth.sub(price),
      feeRecipientBalance,
      feeRecipientBalanceWeth.add(fee),
    );
  });
  it("should not match with wrong order nonce sell", async () => {
    await marketplace.connect(alice).incrementNonce();
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Sell failed authorization");
  });
  it("should not match with wrong order nonce buy", async () => {
    await marketplace.connect(bob).incrementNonce();
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Buy failed authorization");
  });
  it("should not match filled order sell", async () => {
    await marketplace.execute(sellInput, buyInput);
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Sell has invalid parameters");
  });
  it("should not match filled order buy", async () => {
    await marketplace.execute(sellInput, buyInput);
    sell = generateOrder(alice, {
      side: Side.Sell,
      tokenId,
      salt: 1,
    });
    sellInput = await sell.pack();
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Buy has invalid parameters");
  });
  it("should revert if closed", async () => {
    await marketplace.close();
    await expect(marketplace.execute(sellInput, buyInput)).to.be.revertedWith("Closed");
  });
  it("should succeed if reopened", async () => {
    await marketplace.open();

    buyInput = await buy.packNoSigs();
    const tx = await marketplace.connect(bob).execute(sellInput, buyInput);
    const receipt = await tx.wait();
    const gasFee = receipt.gasUsed.mul(receipt.effectiveGasPrice);

    expect(await mockERC721.ownerOf(tokenId)).to.be.equal(bob.address);
    await checkBalances(
      aliceBalance,
      aliceBalanceWeth.add(priceMinusFee),
      bobBalance.sub(gasFee),
      bobBalanceWeth.sub(price),
      feeRecipientBalance,
      feeRecipientBalanceWeth.add(fee),
    );
  });
});
