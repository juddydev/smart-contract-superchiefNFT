// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IERC721, IERC165} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {ReentrancyGuard} from "./libraries/ReentrancyGuard.sol";
import {AssetType, Auction} from "./libraries/Structs.sol";

/**
 * @title English Auction Manager Contract
 */
contract AuctionManager is ReentrancyGuard, ERC721Holder, ERC1155Holder, Ownable, UUPSUpgradeable {
  using SafeERC20 for IERC20;

  /// @dev acutions
  mapping(bytes32 => Auction) public auctions;

  /// @dev emit this event when auction started
  event AuctionStarted(
    bytes32 indexed id,
    address indexed collection,
    address paymentToken,
    uint256 tokenId,
    uint256 minPrice,
    uint256 startTime,
    uint256 endTime
  );
  /// @dev emit this event when new bid added
  event NewBid(bytes32 indexed id, address indexed bidder, uint256 indexed bidPrice);
  /// @dev emit this event when auction finished
  event Finished(bytes32 indexed id, address indexed winner, uint256 indexed bidPrice);

  constructor() {}

  /* Constructor (for ERC1967) */
  function initialize() public initializer {}

  // required by the OZ UUPS module
  function _authorizeUpgrade(address) internal override onlyOwner {}

  /**
   * @notice create auction
   * @param _collection address of collection
   * @param _tokenId token id of nft
   * @param _paymentToken address of bid token
   * @param _minPrice minimum price of bidF
   * @param _startTime time to start auction
   * @param _duration duration of auction
   */
  function createAuction(
    address _collection,
    uint256 _tokenId,
    address _paymentToken,
    uint256 _minPrice,
    uint256 _startTime,
    uint256 _duration
  ) external {
    require(_startTime >= block.timestamp, "Auction: invalid start time");
    AssetType assetType;
    if (IERC165(_collection).supportsInterface(type(IERC721).interfaceId)) {
      assetType = AssetType.ERC721;
    } else if (IERC165(_collection).supportsInterface(type(IERC1155).interfaceId)) {
      assetType = AssetType.ERC1155;
    } else {
      revert("Auction: invalid collection address");
    }

    // calculate id of auction
    bytes32 id = _calculateHash(_collection, _tokenId, _paymentToken, _minPrice);

    auctions[id] = Auction(
      assetType,
      _collection,
      _tokenId,
      _paymentToken,
      _minPrice,
      address(0),
      0,
      _startTime,
      _startTime + _duration,
      msg.sender
    );

    // lock asset to auction contract
    if (assetType == AssetType.ERC721) {
      IERC721(_collection).safeTransferFrom(msg.sender, address(this), _tokenId);
    } else {
      IERC1155(_collection).safeTransferFrom(msg.sender, address(this), _tokenId, 1, "");
    }

    emit AuctionStarted(
      id,
      _collection,
      _paymentToken,
      _tokenId,
      _minPrice,
      _startTime,
      _startTime + _duration
    );
  }

  /**
   * @notice make a new bid
   * @dev This functions changes last bid params, and release last bidder's token
   *      and locks new bidder's token
   * @param _id id of auction
   * @param _price new bidding price
   */
  function bid(bytes32 _id, uint256 _price) external payable nonReentrant {
    require(block.timestamp < auctions[_id].endTime, "Auction: This auction already finished");
    require(_price >= auctions[_id].minPrice, "Auction: bid price is low than minimum price");
    require(_price > auctions[_id].bidPrice, "Auction: bid price is low than last one");

    Auction memory auction = auctions[_id];

    address previousBidder = auction.lastBidder;
    uint256 previousPrice = auction.bidPrice;

    auction.lastBidder = msg.sender;
    auction.bidPrice = _price;
    auctions[_id] = auction;

    if (previousBidder != address(0)) {
      // release last bidder's token
      if (auction.paymentToken == address(0)) {
        payable(previousBidder).transfer(previousPrice);
      }
      IERC20(auction.paymentToken).safeTransfer(previousBidder, previousPrice);
    }

    // lock new bidder's token
    if (auction.paymentToken == address(0)) {
      require(_price == msg.value, "Auction: invalid eth amount");
    } else {
      IERC20(auction.paymentToken).safeTransferFrom(msg.sender, address(this), _price);
    }

    emit NewBid(_id, msg.sender, _price);
  }

  /**
   * @notice finish auction
   * @dev This function finishs auction.
   *      Sends asset to winner and sends bid token to owner.
   * @param _id id of auction
   */
  function finish(bytes32 _id) external {
    require(block.timestamp > auctions[_id].endTime, "Auction: auction not finished");
    require(
      auctions[_id].owner == msg.sender || auctions[_id].lastBidder == msg.sender,
      "Auction: don't have permission to finish"
    );

    // get asset receiver
    address assetReceiver;
    if (auctions[_id].lastBidder == address(0)) {
      assetReceiver = owner();
    } else {
      assetReceiver = auctions[_id].lastBidder;
    }

    // sends asset to receiver
    if (auctions[_id].assetType == AssetType.ERC721) {
      IERC721(auctions[_id].collection).safeTransferFrom(
        address(this),
        assetReceiver,
        auctions[_id].tokenId
      );
    } else if (auctions[_id].assetType == AssetType.ERC1155) {
      IERC1155(auctions[_id].collection).safeTransferFrom(
        address(this),
        assetReceiver,
        auctions[_id].tokenId,
        1,
        ""
      );
    }

    // sends bid token to owner
    if (auctions[_id].paymentToken == address(0)) {
      payable(auctions[_id].owner).transfer(auctions[_id].bidPrice);
    } else {
      IERC20(auctions[_id].paymentToken).safeTransfer(auctions[_id].owner, auctions[_id].bidPrice);
    }

    emit Finished(_id, assetReceiver, auctions[_id].bidPrice);
  }

  function _calculateHash(
    address _collection,
    uint256 _tokenId,
    address _paymentToken,
    uint256 _minPrice
  ) private view returns (bytes32) {
    return
      keccak256(
        abi.encodePacked(msg.sender, _collection, _tokenId, _paymentToken, _minPrice, block.number)
      );
  }
}
