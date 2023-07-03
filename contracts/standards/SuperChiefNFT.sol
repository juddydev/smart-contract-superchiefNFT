// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC1155URIStorage, ERC1155} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

/**
 * @title SuperChief Maketplace NFT Standard
 * @dev use ERC1155URIStorage standard
 */
contract SuperChiefNFT is ERC1155URIStorage {
  /// @dev current max token id
  uint256 public maxId;

  constructor() ERC1155("") {}

  /**
   * @notice mints token to address by amount with tokenUri
   * @param to owner of NFT
   * @param amount amount of NFT
   * @param tokenUri uri of NFT
   */
  function mint(address to, uint256 amount, string calldata tokenUri) external {
    maxId++;
    _mint(to, maxId, amount, "");
    _setBaseURI(tokenUri);
  }
}
