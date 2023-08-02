import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Ship } from "../utils";
import {
  ERC1155Collection,
  ERC1155Collection__factory,
  ERC1155Exhibition,
  ERC1155Exhibition__factory,
} from "../types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments } from "hardhat";
import { constants } from "ethers";
import { arrayify, solidityKeccak256, splitSignature } from "ethers/lib/utils";

chai.use(solidity);
const { expect } = chai;

let ship: Ship;
let collection: ERC1155Collection;
let exhibition: ERC1155Exhibition;

let deployer: SignerWithAddress;
let alice: SignerWithAddress;
let bob: SignerWithAddress;
let signer: SignerWithAddress;

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
    signer = accounts.signer;

    collection = await ship.connect(ERC1155Collection__factory);
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
    await expect(collection.connect(alice).mint(alice.address, 1, "", 100, alice.address)).to.revertedWith(
      "Ownable: caller is not the owner",
    );

    await expect(collection.mint(alice.address, 1, "", 100, alice.address))
      .to.emit(collection, "SuperChiefTransferSingle")
      .withArgs(deployer.address, constants.AddressZero, alice.address, 1, 1);
  });
});

const signMint = async (sender: string, amount: number, to: string, exhibition: string) => {
  const hash = solidityKeccak256(
    ["address", "uint256", "address", "address"],
    [sender, amount, to, exhibition],
  );
  const sig = await signer.signMessage(arrayify(hash));
  const { r, s, v } = splitSignature(sig);
  return {
    r,
    s,
    v,
  };
};

describe("SuperChief Exhibition test", () => {
  before(async () => {
    const { accounts } = await setup();

    deployer = accounts.deployer;
    alice = accounts.alice;
    bob = accounts.bob;

    exhibition = await ship.connect(ERC1155Exhibition__factory);
  });

  it("mint function test", async () => {
    const invalidSign = await signMint(deployer.address, 1, bob.address, exhibition.address);
    await expect(exhibition.mint(alice.address, 1, "", invalidSign, 100, alice.address)).to.revertedWith(
      "Invalid signature",
    );

    const validSign = await signMint(deployer.address, 1, alice.address, exhibition.address);
    await expect(exhibition.mint(alice.address, 1, "", validSign, 100, alice.address))
      .to.emit(exhibition, "SuperChiefTransferSingle")
      .withArgs(deployer.address, constants.AddressZero, alice.address, 1, 1);
  });
});
