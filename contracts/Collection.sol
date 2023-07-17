// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {SuperChiefERC1155} from "./libraries/SuperChiefERC1155.sol";

/**
 * @title SuperChief Maketplace NFT Collection
 * @dev use ERC1155URIStorage standard
 */
contract Collection is SuperChiefERC1155 {
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
  ) SuperChiefERC1155(_name, _symbol, _contractURI, _executionDelegate) {
    emit SuperChiefCollectionCreated(address(this), name, symbol, contractURI, msg.sender);
  }

  /**
   * @notice mints token to address by amount with tokenUri
   * @param to owner of NFT
   * @param amount amount of NFT
   * @param tokenUri uri of NFT
   */
  function mint(address to, uint256 amount, string calldata tokenUri) external onlyOwner {
    maxId++;
    _mint(to, maxId, amount, "");
    _setURI(maxId, tokenUri);
  }
}
