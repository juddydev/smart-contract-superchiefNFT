// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IERC721, IERC165} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IExecutionDelegate} from "./interfaces/IExecutionDelegate.sol";
import {ReentrancyGuard} from "./libraries/ReentrancyGuard.sol";
import {AssetType, Auction, Fee} from "./libraries/Structs.sol";

/**
 * @title English Auction Manager Contract
 */
contract AuctionManager is
  ReentrancyGuard,
  ERC721Holder,
  ERC1155Holder,
  OwnableUpgradeable,
  UUPSUpgradeable
{
  using SafeERC20 for IERC20;

  uint256 public constant INVERSE_BASIS_POINT = 10000;

  /// @dev acutions
  mapping(bytes32 => Auction) public auctions;
  /// @dev execution delegate
  IExecutionDelegate public executionDelegate;

  /// @dev emit this event when auction started
  event AuctionStarted(
    bytes32 indexed id,
    address indexed collection,
    address paymentToken,
    uint256 tokenId,
    uint256 amount,
    uint256 minPrice,
    uint256 startTime,
    uint256 endTime,
    Fee[] fees
  );

  event NewExecutionDelegate(IExecutionDelegate executionDelegate);
  /// @dev emit this event when new bid added
  event NewBid(bytes32 indexed id, address indexed bidder, uint256 indexed bidPrice);
  /// @dev emit this event when auction finished
  event AuctionFinished(bytes32 indexed id, address indexed winner, uint256 indexed bidPrice);
  /// @dev emit this event when bid makes in 15 minutes from endTime
  event AuctionTimeExtended(bytes32 indexed id, uint256 endTime);

  constructor() {}

  /* Constructor (for ERC1967) */
  /**
   * @param _executionDelegate execution delegate address
   */
  function initialize(IExecutionDelegate _executionDelegate) public initializer {
    __Ownable_init();

    executionDelegate = _executionDelegate;
  }

  // required by the OZ UUPS module
  function _authorizeUpgrade(address) internal override onlyOwner {}

  /**
   * @notice create auction
   * @param _collection address of collection
   * @param _tokenId token id of nft
   * @param _amount amount of nft
   * @param _paymentToken address of bid token
   * @param _minPrice minimum price of bid
   * @param _minWinPercent minimum win percent
   * @param _startTime time to start auction
   * @param _duration duration of auction
   * @param _fees fee data
   */
  function createAuction(
    address _collection,
    uint256 _tokenId,
    uint256 _amount,
    address _paymentToken,
    uint256 _minPrice,
    uint256 _minWinPercent,
    uint256 _startTime,
    uint256 _duration,
    Fee[] memory _fees
  ) external {
    require(_startTime >= block.timestamp, "Auction: invalid start time");
    AssetType assetType;
    if (IERC165(_collection).supportsInterface(type(IERC721).interfaceId)) {
      require(_amount == 1, "Auction: invalid token amount");
      assetType = AssetType.ERC721;
    } else if (IERC165(_collection).supportsInterface(type(IERC1155).interfaceId)) {
      assetType = AssetType.ERC1155;
    } else {
      revert("Auction: invalid collection address");
    }

    // calculate id of auction
    bytes32 id = _calculateHash(_collection, _tokenId, _paymentToken, _minPrice);

    Auction storage auction = auctions[id];
    auction.assetType = assetType;
    auction.collection = _collection;
    auction.tokenId = _tokenId;
    auction.paymentToken = _paymentToken;
    auction.minPrice = _minPrice;
    auction.startTime = _startTime;
    auction.endTime = _startTime + _duration;
    auction.minWinPercent = _minWinPercent;
    auction.amount = _amount;
    auction.owner = msg.sender;

    for (uint256 i = 0; i < _fees.length; i++) {
      auction.fees.push(_fees[i]);
    }

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
      _amount,
      _minPrice,
      _startTime,
      _startTime + _duration,
      auction.fees
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
    require(
      _price > (auctions[_id].bidPrice * auctions[_id].minWinPercent) / 100,
      "Auction: bid price is low than minimum win price"
    );

    Auction storage auction = auctions[_id];

    address previousBidder = auction.lastBidder;
    uint256 previousPrice = auction.bidPrice;

    auction.lastBidder = msg.sender;
    auction.bidPrice = _price;

    if (block.timestamp + 900 > auction.endTime) {
      // Any bids made within the last 15 minutes of auction deadline Extends Auction 15 minutes
      auction.endTime += 900;

      emit AuctionTimeExtended(_id, auction.endTime);
    }

    if (previousBidder != address(0)) {
      // release last bidder's token
      if (auction.paymentToken == address(0)) {
        payable(previousBidder).transfer(previousPrice);
      } else {
        IERC20(auction.paymentToken).safeTransfer(previousBidder, previousPrice);
      }
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
      assetReceiver = auctions[_id].owner;
    } else {
      assetReceiver = auctions[_id].lastBidder;
    }

    Fee[] memory fees = executionDelegate.calcuateFee(
      auctions[_id].collection,
      auctions[_id].tokenId,
      auctions[_id].fees
    );

    _executeFundsTransfer(
      auctions[_id].owner,
      auctions[_id].paymentToken,
      fees,
      auctions[_id].bidPrice
    );
    _executeTokenTransfer(
      auctions[_id].collection,
      assetReceiver,
      auctions[_id].tokenId,
      auctions[_id].amount,
      auctions[_id].assetType
    );

    emit AuctionFinished(_id, assetReceiver, auctions[_id].bidPrice);
  }

  /* Setters */
  function setExecutionDelegate(IExecutionDelegate _executionDelegate) external onlyOwner {
    require(address(_executionDelegate) != address(0), "Address cannot be zero");
    executionDelegate = _executionDelegate;
    emit NewExecutionDelegate(executionDelegate);
  }

  /* Internal functions */

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

  /**
   * @dev Execute all ERC20 token / ETH transfers associated with an order match (fees and buyer => seller transfer)
   * @param to destination address
   * @param paymentToken payment token
   * @param fees fees
   * @param price price
   */
  function _executeFundsTransfer(
    address to,
    address paymentToken,
    Fee[] memory fees,
    uint256 price
  ) internal {
    if (paymentToken == address(0)) {
      require(msg.value == price);
    }

    /* Take fee. */
    uint256 receiveAmount = _transferFees(fees, paymentToken, price);

    /* Transfer remainder to seller. */
    _transferTo(paymentToken, to, receiveAmount);
  }

  /**
   * @dev Charge a fee in ETH or WETH
   * @param fees fees to distribute
   * @param paymentToken address of token to pay in
   * @param price price of token
   */
  function _transferFees(
    Fee[] memory fees,
    address paymentToken,
    uint256 price
  ) internal returns (uint256) {
    uint256 totalFee = 0;
    for (uint8 i = 0; i < fees.length; i++) {
      uint256 fee = (price * fees[i].rate) / INVERSE_BASIS_POINT;
      _transferTo(paymentToken, fees[i].recipient, fee);
      totalFee += fee;
    }

    require(totalFee <= price, "Total amount of fees are more than the price");

    /* Amount that will be received by seller. */
    uint256 receiveAmount = price - totalFee;
    return (receiveAmount);
  }

  /**
   * @dev Transfer amount in ETH or WETH
   * @param paymentToken address of token to pay in
   * @param to token recipient
   * @param amount amount to transfer
   */
  function _transferTo(address paymentToken, address to, uint256 amount) internal {
    if (amount == 0) {
      return;
    }

    if (paymentToken == address(0)) {
      /* Transfer funds in ETH. */
      payable(to).transfer(amount);
    } else {
      /* Transfer funds in WETH. */
      IERC20(paymentToken).safeTransfer(to, amount);
    }
  }

  /**
   * @dev Execute call through delegate proxy
   * @param collection collection contract address
   * @param to buyer address
   * @param tokenId tokenId
   * @param assetType asset type of the token
   */
  function _executeTokenTransfer(
    address collection,
    address to,
    uint256 tokenId,
    uint256 amount,
    AssetType assetType
  ) internal {
    /* Assert collection exists. */
    require(_exists(collection), "Collection does not exist");

    /* Call execution delegate. */
    if (assetType == AssetType.ERC721) {
      IERC721(collection).safeTransferFrom(address(this), to, tokenId);
    } else if (assetType == AssetType.ERC1155) {
      IERC1155(collection).safeTransferFrom(address(this), to, tokenId, amount, "");
    }
  }

  /**
   * @dev Determine if the given address exists
   * @param what address to check
   */
  function _exists(address what) internal view returns (bool) {
    uint size;
    assembly {
      size := extcodesize(what)
    }
    return size > 0;
  }
}
