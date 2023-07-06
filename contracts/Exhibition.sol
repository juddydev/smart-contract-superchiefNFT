// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {SuperChiefERC1155} from "./libraries/SuperChiefERC1155.sol";

/**
 * @title SuperChief Exhibition contract
 * @dev use ERC1155URIStorage standard
 */
contract Exhibition is SuperChiefERC1155 {
  /// @dev mint count of artists
  mapping(address => uint256) public mintCount;

  /// @dev fires when mint count updated
  event MintCountUpdated(address indexed to, uint256 count);

  /**
   * @dev sets contract params
   * @param _name name of collection
   * @param _symbol symbol of collection
   * @param _contractURI uri of contract
   */
  constructor(
    string memory _name,
    string memory _symbol,
    string memory _contractURI
  ) SuperChiefERC1155(_name, _symbol, _contractURI) {}

  /**
   * @notice update mint count of artist
   * @param _to address of artist
   * @param _count count of mint
   */
  function updateMintCount(address _to, uint256 _count) public onlyOwner {
    mintCount[_to] = _count;

    emit MintCountUpdated(_to, _count);
  }

  /**
   * @notice update mint count of artist
   * @param _to address of artist
   * @param _count count of mint
   */
  function batchUpdateMintCount(
    address[] calldata _to,
    uint256[] calldata _count
  ) external onlyOwner {
    require(_to.length == _count.length, "Exhibition: invalid input param");

    for (uint256 i = 0; i < _to.length; ++i) {
      updateMintCount(_to[i], _count[i]);
    }
  }

  /**
   * @notice mints token to address by amount with tokenUri
   * @param to owner of NFT
   * @param tokenUri uri of NFT
   */
  function mint(address to, string calldata tokenUri) external {
    require(mintCount[msg.sender] > 0, "Exhibition: don't have mint permission");

    --mintCount[msg.sender];
    maxId++;

    _mint(to, maxId, 1, "");
    _setBaseURI(tokenUri);
  }
}
