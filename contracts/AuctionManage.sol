// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.9;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ReentrancyGuard} from "./libraries/ReentrancyGuard.sol";
import {AssetType, Auction} from "./libraries/Structs.sol";

/**
 * @title English Auction Contract
 */
contract EnglishAuction is ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;

  /// @dev weth address
  address public weth;
  /// @dev acutions
  mapping(bytes32 => Auction) public auctions;

  /// @dev emit this event when auction started
  event AuctionStarted(
    bytes32 indexed id,
    address indexed assetAddress,
    address bidToken,
    uint256 tokenId,
    uint256 minPrice,
    uint256 startTime,
    uint256 endTime
  );
  /// @dev emit this event when new bid added
  event NewBid(bytes32 indexed id, address indexed bidder, uint256 indexed bidPrice);
  /// @dev emit this event when auction finished
  event Finished(bytes32 indexed id, address indexed winner, uint256 indexed bidPrice);

  /// @param _weth weth address
  constructor(address _weth) {
    weth = _weth;
  }

  /**
   * @notice create auction
   */
  function createAuction() external onlyOwner {
    lastBlock = block.number;

    // lock asset to auction contract
    if (assetType == AssetType.ETH) {
      require(msg.value == assetParam, "Auction: invalid eth amount");
    } else if (assetType == AssetType.ERC20) {
      IERC20(assetAddress).safeTransferFrom(msg.sender, address(this), assetParam);
    } else if (assetType == AssetType.ERC721) {
      IERC721(assetAddress).safeTransferFrom(msg.sender, address(this), assetParam, "");
    } else if (assetType == AssetType.ERC1155) {
      IERC1155(assetAddress).safeTransferFrom(msg.sender, address(this), assetParam, 1, "");
    } else {
      revert("Auction: assetType is invalid");
    }

    emit AuctionStarted();
  }

  /**
   * @notice propose new bid
   * @dev This functions changes last bid params, and release last bidder's token
   *      and locks new bidder's token
   * @param _price new bidding price
   */
  function propose(uint256 _price) external payable nonReentrant {
    require(lastBlock > 0, "Auction: auction not started yet");
    require(block.number <= lastBlock + maxBidInterval, "Auction: no bids anymore");
    require(_price > lastPrice, "Auction: bid price is low than last one");

    address previousBidder = lastBidder;
    uint256 previousPrice = lastPrice;

    // changes last bid params
    lastPrice = _price;
    lastBidder = msg.sender;
    lastBlock = block.number;

    if (previousBidder != address(0)) {
      // release last bidder's token
      if (bidToken == address(0)) {
        payable(previousBidder).transfer(previousPrice);
      }
      IERC20(bidToken).safeTransfer(previousBidder, previousPrice);
    }

    // lock new bidder's token
    if (bidToken == address(0)) {
      require(_price == msg.value, "Auction: invalid eth amount");
    } else {
      IERC20(bidToken).safeTransferFrom(msg.sender, address(this), _price);
    }

    emit NewBid(msg.sender, _price);
  }

  /**
   * @notice finish auction
   * @dev This function finishs auction.
   *      Sends asset to winner and sends bid token to owner.
   */
  function finish() external onlyOwner {
    require(block.number > lastBlock + maxBidInterval, "Auction: auction not finished");

    // get asset receiver
    address assetReceiver;
    if (lastBidder == address(0)) {
      assetReceiver = owner();
    } else {
      assetReceiver = lastBidder;
    }

    // sends asset to receiver
    if (assetType == AssetType.ETH) {
      payable(assetReceiver).transfer(assetParam);
    } else if (assetType == AssetType.ERC20) {
      IERC20(assetAddress).safeTransfer(assetReceiver, assetParam);
    } else if (assetType == AssetType.ERC721) {
      IERC721(assetAddress).safeTransferFrom(address(this), assetReceiver, assetParam);
    } else if (assetType == AssetType.ERC1155) {
      IERC1155(assetAddress).safeTransferFrom(address(this), assetReceiver, assetParam, 1, "");
    }

    // sends bid token to owner
    if (bidToken == address(0)) {
      payable(owner()).transfer(lastPrice);
    } else {
      IERC20(bidToken).safeTransfer(owner(), lastPrice);
    }

    emit Finished(assetReceiver, lastPrice);
  }
}
