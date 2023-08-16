// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract AdminUpgradeableProxy is TransparentUpgradeableProxy {
  constructor(
    address logic,
    address admin,
    bytes memory data
  ) payable TransparentUpgradeableProxy(logic, admin, data) {}
}
