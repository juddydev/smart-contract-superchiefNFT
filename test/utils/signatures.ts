import { TypedDataUtils, SignTypedDataVersion } from "@metamask/eth-sig-util";
import { Contract, Signature, ethers } from "ethers";
import { OrderParameters, OrderWithNonce } from "./structure";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { splitSignature } from "ethers/lib/utils";
import { MerkleTree } from "merkletreejs";
import { config } from "hardhat";
const { eip712Hash, hashStruct } = TypedDataUtils;

const eip712Fee = {
  name: "Fee",
  fields: [
    { name: "rate", type: "uint16" },
    { name: "recipient", type: "address" },
  ],
};

const eip712Order = {
  name: "Order",
  fields: [
    { name: "trader", type: "address" },
    { name: "side", type: "uint8" },
    { name: "matchingPolicy", type: "address" },
    { name: "collection", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "paymentToken", type: "address" },
    { name: "price", type: "uint256" },
    { name: "listingTime", type: "uint256" },
    { name: "expirationTime", type: "uint256" },
    { name: "fees", type: "Fee[]" },
    { name: "salt", type: "uint256" },
    { name: "extraParams", type: "bytes" },
    { name: "nonce", type: "uint256" },
  ],
};

const eip712OracleOrder = {
  name: "OracleOrder",
  fields: [
    { name: "order", type: "Order" },
    { name: "blockNumber", type: "uint256" },
  ],
};

export interface Field {
  name: string;
  type: string;
}

export interface Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface TypedData {
  name: string;
  fields: Field[];
  domain: Domain;
  data: OrderParameters;
}

export function hashWithoutDomain(parameters: any): string {
  parameters.nonce = parameters.nonce.toHexString();
  parameters.price = parameters.price.toHexString();
  return `0x${hashStruct(
    "Order",
    parameters,
    {
      [eip712Fee.name]: eip712Fee.fields,
      [eip712Order.name]: eip712Order.fields,
    },
    SignTypedDataVersion.V4,
  ).toString("hex")}`;
}

export function hash(parameters: any, marketplace: Contract): string {
  parameters.nonce = parameters.nonce.toHexString();
  parameters.price = parameters.price.toHexString();
  return `0x${eip712Hash(
    {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        [eip712Fee.name]: eip712Fee.fields,
        [eip712Order.name]: eip712Order.fields,
      },
      primaryType: "Order",
      domain: {
        name: "SuperChief Marketplace",
        version: "1.0",
        chainId: 1337, // hardhat chain id
        verifyingContract: marketplace.address,
      },
      message: parameters,
    },
    SignTypedDataVersion.V4,
  ).toString("hex")}`;
}

function structToSign(order: OrderWithNonce, exchange: string): TypedData {
  return {
    name: eip712Order.name,
    fields: eip712Order.fields,
    domain: {
      name: "SuperChief Marketplace",
      version: "1.0",
      chainId: 1337, // hardhat chain id
      verifyingContract: exchange,
    },
    data: order,
  };
}

export async function sign(
  order: OrderParameters,
  account: SignerWithAddress,
  exchange: Contract,
): Promise<Signature> {
  const nonce = await exchange.nonces(order.trader);
  const str = structToSign({ ...order, nonce }, exchange.address);

  return account
    ._signTypedData(
      str.domain,
      {
        [eip712Fee.name]: eip712Fee.fields,
        [eip712Order.name]: eip712Order.fields,
      },
      str.data,
    )
    .then(async (sigBytes) => {
      const sig = splitSignature(sigBytes);
      return sig;
    });
}

export function packSignature(signature: Signature): string {
  return ethers.utils.defaultAbiCoder.encode(
    ["uint8", "bytes32", "bytes32"],
    [signature.v, signature.r, signature.s],
  );
}

export async function oracleSign(
  order: OrderParameters,
  account: SignerWithAddress,
  exchange: Contract,
  blockNumber: number,
): Promise<Signature> {
  const nonce = await exchange.nonces(order.trader);
  const str = structToSign({ ...order, nonce }, exchange.address);
  return account
    ._signTypedData(
      str.domain,
      {
        [eip712Fee.name]: eip712Fee.fields,
        [eip712Order.name]: eip712Order.fields,
        [eip712OracleOrder.name]: eip712OracleOrder.fields,
      },
      { order: str.data, blockNumber },
    )
    .then((sigBytes) => {
      const sig = ethers.utils.splitSignature(sigBytes);
      return sig;
    });
}

export function getMerkleProof(leaves: string[]) {
  const tree = new MerkleTree(leaves, ethers.utils.keccak256, { sort: true });
  const root = tree.getHexRoot();
  return { root, tree };
}

async function getOrderTreeRoot(orders: OrderParameters[], exchange: Contract) {
  const leaves = await Promise.all(
    orders.map(async (order) => {
      const nonce = await exchange.nonces(order.trader);
      return hashWithoutDomain({ ...order, nonce });
    }),
  );
  return getMerkleProof(leaves);
}

export async function signBulk(orders: OrderParameters[], account: SignerWithAddress, exchange: Contract) {
  const { tree, root } = await getOrderTreeRoot(orders, exchange);
  const nonce = await exchange.nonces(orders[0].trader);
  const _order = hashWithoutDomain({ ...orders[0], nonce });
  const signature = await account
    ._signTypedData(
      {
        name: "SuperChief Marketplace",
        version: "1.0",
        chainId: 1337, // hardhat chain id
        verifyingContract: exchange.address,
      },
      {
        Root: [{ name: "root", type: "bytes32" }],
      },
      { root },
    )
    .then((sigBytes) => {
      const sig = ethers.utils.splitSignature(sigBytes);
      return sig;
    });
  return {
    path: ethers.utils.defaultAbiCoder.encode(["bytes32[]"], [tree.getHexProof(_order)]),
    r: signature.r,
    v: signature.v,
    s: signature.s,
  };
}
