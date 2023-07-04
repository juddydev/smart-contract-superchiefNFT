// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC1155URIStorage, ERC1155} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

/**
 * @title SuperChief Exhibition contract
 * @dev use ERC1155URIStorage standard
 */
contract Exhibition is ERC1155URIStorage, Ownable {
  /// @dev current max token id
  uint256 public maxId;

  /// @dev title of exhibition
  string public title;
  /// @dev description of exhibition
  string public description;

  /// @dev mint count of artists
  mapping(address => uint256) public mintCount;

  /// @dev fires when mint count updated
  event MintCountUpdated(address indexed to, uint256 count);

  /**
   * @param _title title of exhibition
   * @param _description description of exhibition
   */
  constructor(string memory _title, string memory _description) ERC1155("") {
    title = _title;
    description = _description;
  }

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
