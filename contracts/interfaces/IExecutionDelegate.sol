// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Fee, Sig} from "../libraries/Structs.sol";

interface IExecutionDelegate {
  function contracts(address to) external view returns (bool);

  function blacklisted(address to) external view returns (bool);

  function approveContract(address _contract) external;

  function denyContract(address _contract) external;

  function revokeApproval() external;

  function grantApproval() external;

  function transferERC721Unsafe(
    address collection,
    address from,
    address to,
    uint256 tokenId
  ) external;

  function transferERC721(address collection, address from, address to, uint256 tokenId) external;

  function transferERC1155(
    address collection,
    address from,
    address to,
    uint256 tokenId,
    uint256 amount
  ) external;

  function transferERC20(
    address token,
    address from,
    address to,
    uint256 amount
  ) external returns (bool);

  function calcuateFee(
    address _collection,
    uint256 _tokenId,
    Fee[] memory _fees
  ) external view returns (Fee[] memory fees);

  function validateSign(address sender, Sig calldata sig) external view returns (bool);
}
