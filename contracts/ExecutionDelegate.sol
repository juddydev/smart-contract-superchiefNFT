// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {IExecutionDelegate} from "./interfaces/IExecutionDelegate.sol";
import {Fee} from "./libraries/Structs.sol";

/**
 * @title ExecutionDelegate
 * @dev Proxy contract to manage user token approvals
 */
contract ExecutionDelegate is IExecutionDelegate, Ownable {
  mapping(address => bool) public contracts;
  mapping(address => bool) public revokedApproval;
  Fee[] public baseFee;

  modifier approvedContract() {
    require(contracts[msg.sender], "Contract is not approved to make transfers");
    _;
  }

  event ApproveContract(address indexed _contract);
  event DenyContract(address indexed _contract);

  event RevokeApproval(address indexed user);
  event GrantApproval(address indexed user);
  event NewBaseFee(Fee[] fees);

  /**
   * @dev Approve contract to call transfer functions
   * @param _contract address of contract to approve
   */
  function approveContract(address _contract) external onlyOwner {
    contracts[_contract] = true;
    emit ApproveContract(_contract);
  }

  /**
   * @dev Revoke approval of contract to call transfer functions
   * @param _contract address of contract to revoke approval
   */
  function denyContract(address _contract) external onlyOwner {
    contracts[_contract] = false;
    emit DenyContract(_contract);
  }

  /**
   * @dev Block contract from making transfers on-behalf of a specific user
   */
  function revokeApproval() external {
    revokedApproval[msg.sender] = true;
    emit RevokeApproval(msg.sender);
  }

  /**
   * @dev Allow contract to make transfers on-behalf of a specific user
   */
  function grantApproval() external {
    revokedApproval[msg.sender] = false;
    emit GrantApproval(msg.sender);
  }

  /**
   * @dev Transfer ERC721 token using `transferFrom`
   * @param collection address of the collection
   * @param from address of the sender
   * @param to address of the recipient
   * @param tokenId tokenId
   */
  function transferERC721Unsafe(
    address collection,
    address from,
    address to,
    uint256 tokenId
  ) external approvedContract {
    require(revokedApproval[from] == false, "User has revoked approval");
    IERC721(collection).transferFrom(from, to, tokenId);
  }

  /**
   * @dev Transfer ERC721 token using `safeTransferFrom`
   * @param collection address of the collection
   * @param from address of the sender
   * @param to address of the recipient
   * @param tokenId tokenId
   */
  function transferERC721(
    address collection,
    address from,
    address to,
    uint256 tokenId
  ) external approvedContract {
    require(revokedApproval[from] == false, "User has revoked approval");
    IERC721(collection).safeTransferFrom(from, to, tokenId);
  }

  /**
   * @dev Transfer ERC1155 token using `safeTransferFrom`
   * @param collection address of the collection
   * @param from address of the sender
   * @param to address of the recipient
   * @param tokenId tokenId
   * @param amount amount
   */
  function transferERC1155(
    address collection,
    address from,
    address to,
    uint256 tokenId,
    uint256 amount
  ) external approvedContract {
    require(revokedApproval[from] == false, "User has revoked approval");
    IERC1155(collection).safeTransferFrom(from, to, tokenId, amount, "");
  }

  /**
   * @dev Transfer ERC20 token
   * @param token address of the token
   * @param from address of the sender
   * @param to address of the recipient
   * @param amount amount
   */
  function transferERC20(
    address token,
    address from,
    address to,
    uint256 amount
  ) external approvedContract returns (bool) {
    require(revokedApproval[from] == false, "User has revoked approval");
    return IERC20(token).transferFrom(from, to, amount);
  }

  //////////////////
  // fee calculator logic
  /**
   * @dev caculates fee
   * @param _collection collection address
   * @param _fees requesting fee
   * @param _tokenId id of token
   * @return fees cauculated fee
   */
  function calcuateFee(
    address _collection,
    uint256 _tokenId,
    Fee[] memory _fees
  ) external view returns (Fee[] memory fees) {
    fees = new Fee[](0);
    if (IERC165(_collection).supportsInterface(type(IERC2981).interfaceId)) {
      fees = new Fee[](_fees.length + baseFee.length + 1);
      (address receiver, uint256 royaltyAmount) = IERC2981(_collection).royaltyInfo(
        _tokenId,
        10000
      );
      fees[0] = Fee({recipient: payable(receiver), rate: uint16(royaltyAmount)});
      for (uint256 i = 0; i < _fees.length; i++) {
        fees[i + 1] = _fees[i];
      }
      for (uint256 i = 0; i < baseFee.length; i++) {
        fees[i + _fees.length + 1] = baseFee[i];
      }
    } else {
      fees = new Fee[](_fees.length + baseFee.length + 1);
      for (uint256 i = 0; i < _fees.length; i++) {
        fees[i] = _fees[i];
      }
      for (uint256 i = 0; i < baseFee.length; i++) {
        fees[i + _fees.length] = baseFee[i];
      }
    }
  }

  /**
   * @dev update base fees
   * @param fees fees to update
   */
  function updateBaseFee(Fee[] calldata fees) external onlyOwner {
    delete baseFee;
    for (uint256 i = 0; i < fees.length; i++) {
      baseFee.push(fees[i]);
    }

    emit NewBaseFee(fees);
  }

  /**
   * @dev update base fees
   * @param rate fees rate to add
   * @param receiver receiver of fee to add
   */
  function addBaseFee(uint16 rate, address receiver) external onlyOwner {
    Fee memory newFee = Fee({recipient: payable(receiver), rate: rate});
    baseFee.push(newFee);

    emit NewBaseFee(baseFee);
  }

  /**
   * @dev clears base fee data
   */
  function clearBaseFee() external onlyOwner {
    delete baseFee;

    emit NewBaseFee(baseFee);
  }
}
