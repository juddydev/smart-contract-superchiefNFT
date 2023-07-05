// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Input, Order} from "../libraries/Structs.sol";
import {IExecutionDelegate} from "./IExecutionDelegate.sol";
import {IPolicyManager} from "./IPolicyManager.sol";

interface IMarketplace {
  function nonces(address) external view returns (uint256);

  function close() external;

  function initialize(
    uint chainId,
    address _weth,
    IExecutionDelegate _executionDelegate,
    IPolicyManager _policyManager,
    address _oracle,
    uint _blockRange
  ) external;

  function setExecutionDelegate(IExecutionDelegate _executionDelegate) external;

  function setPolicyManager(IPolicyManager _policyManager) external;

  function setOracle(address _oracle) external;

  function setBlockRange(uint256 _blockRange) external;

  function cancelOrder(Order calldata order) external;

  function cancelOrders(Order[] calldata orders) external;

  function incrementNonce() external;

  function execute(Input calldata sell, Input calldata buy) external payable;
}
