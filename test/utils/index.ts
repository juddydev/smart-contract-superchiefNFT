import { expect } from "chai";

export * from "./setup";
export * from "./signatures";
export * from "./structure";

export async function assertPublicMutableMethods(contract: any, expectedPublicMethods: string[]) {
  const allModifiableFns = Object.values(contract.interface.functions)
    .filter((f: any) => {
      return f.stateMutability === "nonpayable" || f.stateMutability === "payable";
    })
    .map((f: any) => f.format());
  expect(allModifiableFns.sort()).to.be.deep.eq(expectedPublicMethods.sort());
}
