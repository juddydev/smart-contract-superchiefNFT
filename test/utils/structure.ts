import { BigNumber, constants } from "ethers";
import { hash, hashWithoutDomain, oracleSign, packSignature, sign, signBulk } from "./signatures";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { Marketplace } from "../../types";

export enum Side {
  Buy = 0,
  Sell = 1,
}

export interface Fee {
  rate: number;
  recipient: string;
}

export interface OrderParameters {
  trader: string;
  side: Side;
  matchingPolicy: string;
  collection: string;
  tokenId: string | number;
  amount: string | number;
  paymentToken: string;
  price: BigNumber;
  listingTime: string;
  expirationTime: string;
  fees: Fee[];
  salt: number;
  extraParams: string;
}

export interface OrderWithNonce extends OrderParameters {
  nonce: any;
}

export class Order {
  parameters: OrderParameters;
  user: any;
  admin: any;
  exchange: any;

  constructor(user: any, parameters: OrderParameters, admin: SignerWithAddress, exchange: Marketplace) {
    this.user = user;
    this.parameters = parameters;
    this.admin = admin;
    this.exchange = exchange;
  }

  async hash(): Promise<string> {
    const nonce = await this.exchange.nonces(this.parameters.trader);
    return hashWithoutDomain({ ...this.parameters, nonce });
  }

  async hashToSign(): Promise<string> {
    const nonce = await this.exchange.nonces(this.parameters.trader);
    return hash({ ...this.parameters, nonce }, this.exchange);
  }

  async pack(options: { signer?: SignerWithAddress; oracle?: SignerWithAddress; blockNumber?: number } = {}) {
    const signature = await sign(this.parameters, options.signer || this.user, this.exchange);
    return {
      order: this.parameters,
      v: signature.v,
      r: signature.r,
      s: signature.s,
      extraSignature: packSignature(
        await oracleSign(
          this.parameters,
          options.oracle || this.admin,
          this.exchange,
          options.blockNumber || (await ethers.provider.getBlock("latest")).number,
        ),
      ),
      signatureVersion: 0, // single
      blockNumber: (await ethers.provider.getBlock("latest")).number,
    };
  }

  async packNoSigs() {
    return {
      order: this.parameters,
      v: 27,
      r: constants.HashZero,
      s: constants.HashZero,
      extraSignature: "0x",
      signatureVersion: 0, // single
      blockNumber: (await ethers.provider.getBlock("latest")).number,
    };
  }

  async packBulk(otherOrders: Order[]) {
    const { path, r, v, s } = await signBulk(
      [this.parameters, ...otherOrders.map((_) => _.parameters)],
      this.user,
      this.exchange,
    );
    const oracleSig = await oracleSign(
      this.parameters,
      this.admin,
      this.exchange,
      (
        await ethers.provider.getBlock("latest")
      ).number,
    );
    return {
      order: this.parameters,
      r,
      v,
      s,
      extraSignature: ethers.utils.defaultAbiCoder.encode(
        ["bytes32[]", "uint8", "bytes32", "bytes32"],
        [ethers.utils.defaultAbiCoder.decode(["bytes32[]"], path)[0], oracleSig.v, oracleSig.r, oracleSig.s],
      ),
      signatureVersion: 1, // bulk
      blockNumber: (await ethers.provider.getBlock("latest")).number,
    };
  }
}
