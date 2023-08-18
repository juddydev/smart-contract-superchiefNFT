// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {IExecutionDelegate} from "./interfaces/IExecutionDelegate.sol";
import {Fee, Sig} from "./libraries/Structs.sol";

/**
 * @title ExecutionDelegate
 * @dev Proxy contract to manage user token approvals
 */
contract ExecutionDelegate is IExecutionDelegate, OwnableUpgradeable {
  mapping(address => bool) public contracts;
  mapping(address => bool) public revokedApproval;
  mapping(address => uint256) public nonce;
  mapping(address => bool) public blacklisted;

  address public signer;

  Fee[] public baseFee;

  modifier approvedContract() {
    require(contracts[msg.sender], "Contract is not approved to make transfers");
    _;
  }

  event ApproveContract(address indexed _contract);
  event DenyContract(address indexed _contract);

  event AddedBlackList(address _to, string name);
  event RemovedBlackList(address _to);

  event RevokeApproval(address indexed user);
  event GrantApproval(address indexed user);
  event ClearedBaseFee();
  event NewBaseFee(uint16 id, string label, uint16 rate, address receipt);

  /* Constructor (for ERC1967) */
  /// @param _signer signer address
  function initialize(address _signer) public initializer {
    __Ownable_init();

    signer = _signer;
  }

  modifier onlySuperAdmin(Sig calldata sig) {
    require(validateSign(msg.sender, sig) || msg.sender == owner(), "Owner sign is invalid");
    nonce[_msgSender()]++;
    _;
  }

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
   * @dev adds address to blacklist
   * @param _to address to add blacklist
   * @param _name name of contract
   * @param _sig sign of owner
   */
  function addBlacklist(
    address _to,
    string memory _name,
    Sig calldata _sig
  ) external onlySuperAdmin(_sig) {
    blacklisted[_to] = true;
    emit AddedBlackList(_to, _name);
  }

  /**
   * @dev adds address to blacklist
   * @param _to address to add blacklist
   * @param _sig sign of owner
   */
  function removeBlacklist(address _to, Sig calldata _sig) external onlySuperAdmin(_sig) {
    blacklisted[_to] = false;
    emit RemovedBlackList(_to);
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

  function updateSigner(address _signer) external onlyOwner {
    signer = _signer;
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
    Fee[] calldata _fees
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
   * @param id id of fee
   * @param label label of fee
   * @param rate fee rate
   * @param receiver fee receiver
   * @param sig signature of owner wallet
   */
  function updateBaseFee(
    uint16 id,
    string memory label,
    uint16 rate,
    address receiver,
    Sig calldata sig
  ) external onlySuperAdmin(sig) {
    require(baseFee.length > id, "Invalid id");
    baseFee[id] = Fee(rate, payable(receiver));

    emit NewBaseFee(id, label, rate, receiver);
  }

  /**
   * @dev update base fees
   * @param label label of fee
   * @param rate fees rate to add
   * @param receiver receiver of fee to add
   */
  function addBaseFee(
    string memory label,
    uint16 rate,
    address receiver,
    Sig calldata sig
  ) external onlySuperAdmin(sig) {
    Fee memory newFee = Fee({recipient: payable(receiver), rate: rate});
    baseFee.push(newFee);

    emit NewBaseFee(uint16(baseFee.length - 1), label, rate, receiver);
  }

  /**
   * @dev clears all base fee
   */
  function clearBaseFee(Sig calldata sig) external onlySuperAdmin(sig) {
    delete baseFee;

    emit ClearedBaseFee();
  }

  /**
   * @dev validate signature of contract owner
   * @param sender address of sender
   * @param sig sign of owner
   */
  function validateSign(address sender, Sig calldata sig) public view returns (bool) {
    bytes32 messageHash = keccak256(abi.encodePacked(sender, nonce[_msgSender()]));

    bytes32 ethSignedMessageHash = keccak256(
      abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
    );

    return signer == ecrecover(ethSignedMessageHash, sig.v, sig.r, sig.s);
  }
}
