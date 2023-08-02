// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {SuperChiefERC721} from "../libraries/SuperChiefERC721.sol";

/**
 * @title SuperChief Maketplace NFT Collection
 * @dev use ERC721URIStorage standard
 */
contract ERC721Collection is SuperChiefERC721 {
  /// @dev current max token id
  uint256 public maxId;

  /// @dev new collection added
  event SuperChiefCollectionCreated(
    address indexed collection,
    string name,
    string symbol,
    string contractURI,
    address owner
  );
  event SuperChiefNftMinted(uint256 tokenId, address owner, uint256 amount, string tokenUri);

  /**
   * @dev sets contract params
   * @param _name name of collection
   * @param _symbol symbol of collection
   * @param _contractURI uri of contract,
   * @param _executionDelegate address of execution delegate
   */
  constructor(
    string memory _name,
    string memory _symbol,
    string memory _contractURI,
    address _executionDelegate
  ) SuperChiefERC721(_name, _symbol, _contractURI, _executionDelegate) {
    emit SuperChiefCollectionCreated(address(this), _name, _symbol, _contractURI, msg.sender);
  }

  /**
   * @notice mints token to address by amount with tokenUri
   * @param to owner of NFT
   * @param tokenUri uri of NFT
   * @param feeRate fee rate
   * @param receiver fee receiver address
   */
  function mint(
    address to,
    string calldata tokenUri,
    uint96 feeRate,
    address receiver
  ) external onlyOwner returns (uint256) {
    require(feeRate <= 1800, "SuperChief: creator fee must be less than 18%");
    maxId++;
    _mint(to, maxId);
    _setTokenURI(maxId, tokenUri);
    _setTokenRoyalty(maxId, receiver, feeRate);

    emit SuperChiefNftMinted(maxId, to, 1, tokenUri);

    return maxId;
  }
}
