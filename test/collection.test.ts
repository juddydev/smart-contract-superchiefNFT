import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../utils";
import { Collection, Collection__factory, Exhibition, Exhibition__factory } from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments } from "hardhat";
import { constants } from "ethers";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let collection: Collection;
let exhibition: Exhibition;

let deployer: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;

const setup = deployments.createFixture(async (hre) => {
  ship = await Ship.init(hre);
  const { accounts, users } = ship;
  await deployments.fixture(["collection", "exhibition"]);

  return {
    ship,
    accounts,
    users,
  };
});

describe("SuperChief Collection test", () => {
  before(async () => {
    const { accounts } = await setup();

    deployer = accounts.deployer;
    alice = accounts.alice;
    bob = accounts.bob;

    collection = await ship.connect(Collection__factory);
  });

  it("contract uri test", async () => {
    expect(await collection.contractURI()).to.eq("");
    await expect(collection.setContractURI("https://fake.uri"))
      .to.emit(collection, "ContractURIChanged")
      .withArgs("https://fake.uri");

    // only owner can change contract uri
    await expect(collection.connect(alice).setContractURI("https://alice.fake")).to.revertedWith(
      "Ownable: caller is not the owner",
    );
  });

  it("mint functionality test", async () => {
    await expect(collection.connect(alice).mint(alice.address, 1, "")).to.revertedWith(
      "Ownable: caller is not the owner",
    );

    await expect(collection.mint(alice.address, 1, ""))
      .to.emit(collection, "SuperChiefTransferSingle")
      .withArgs(deployer.address, constants.AddressZero, alice.address, 1, 1);
  });
});

describe("SuperChief Exhibition test", () => {
  before(async () => {
    const { accounts } = await setup();

    deployer = accounts.deployer;
    alice = accounts.alice;
    bob = accounts.bob;

    exhibition = await ship.connect(Exhibition__factory);
  });

  it("mint count update test", async () => {
    await expect(exhibition.connect(alice).updateMintCount(alice.address, 1)).to.revertedWith(
      "Ownable: caller is not the owner",
    );

    await expect(exhibition.updateMintCount(alice.address, 1))
      .to.emit(exhibition, "MintCountUpdated")
      .withArgs(alice.address, 1);

    await expect(exhibition.batchUpdateMintCount([alice.address, bob.address], [2])).to.revertedWith(
      "Exhibition: invalid input param",
    );

    await expect(exhibition.batchUpdateMintCount([alice.address, bob.address], [2, 1]))
      .to.emit(exhibition, "BatchMintCountUpdated")
      .withArgs([alice.address, bob.address], [2, 1]);
  });

  it("mint function test", async () => {
    await expect(exhibition.mint(alice.address, "")).to.revertedWith(
      "Exhibition: don't have mint permission",
    );

    await expect(exhibition.connect(bob).mint(alice.address, ""))
      .to.emit(exhibition, "TransferSingle")
      .withArgs(bob.address, constants.AddressZero, alice.address, 1, 1);

    await expect(exhibition.connect(bob).mint(alice.address, "")).to.revertedWith(
      "Exhibition: don't have mint permission",
    );
  });
});
