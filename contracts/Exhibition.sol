// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981, IERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ERC1155URIStorage, ERC1155, IERC1155, IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

/**
 * @title SuperChief Exhibition contract
 * @dev use ERC1155URIStorage standard
 */
contract Exhibition is ERC1155URIStorage, ERC2981, Ownable {
  /// @dev collection params
  string public name;
  string public symbol;
  string public contractURI;

  /// @dev current max token id
  uint256 public maxId;

  /// @dev mint count of artists
  mapping(address => uint256) public mintCount;

  /// @dev fires when contract uri changed
  event ContractURIChanged(string _contractURI);
  /// @dev fires when mint count updated
  event MintCountUpdated(address indexed to, uint256 count);

  /**
   * @dev sets contract params
   * @param _name name of collection
   * @param _symbol symbol of collection
   * @param _contractURI uri of contract
   */
  constructor(string memory _name, string memory _symbol, string memory _contractURI) ERC1155("") {
    name = _name;
    symbol = _symbol;

    setContractURI(_contractURI);
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(ERC2981, ERC1155) returns (bool) {
    return
      interfaceId == type(IERC1155).interfaceId ||
      interfaceId == type(IERC1155MetadataURI).interfaceId ||
      interfaceId == type(IERC2981).interfaceId ||
      super.supportsInterface(interfaceId);
  }

  /**
   * @dev Set contract url
   * @param _contractURI IPFS url for contract metadata
   */
  function setContractURI(string memory _contractURI) public onlyOwner {
    contractURI = _contractURI;

    emit ContractURIChanged(_contractURI);
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

  /// @dev royalty functions
  /**
   * @notice set royalty settings
   * @param receiver fee receiver
   * @param feeNumerator fee numerator
   */
  function setDefaultRoyalty(address receiver, uint96 feeNumerator) external onlyOwner {
    _setDefaultRoyalty(receiver, feeNumerator);
  }

  /**
   * @notice Removes default royalty information.
   */
  function deleteDefaultRoyalty() external onlyOwner {
    _deleteDefaultRoyalty();
  }

  /**
   * @notice Sets the royalty information for a specific token id, overriding the global default.
   * @param receiver receiver of fee
   * @param feeNumerator fee numerator.
   */
  function setTokenRoyalty(
    uint256 tokenId,
    address receiver,
    uint96 feeNumerator
  ) external onlyOwner {
    _setTokenRoyalty(tokenId, receiver, feeNumerator);
  }

  /**
   * @notice Resets royalty information for the token id back to the global default.
   */
  function resetTokenRoyalty(uint256 tokenId) external onlyOwner {
    _resetTokenRoyalty(tokenId);
  }
}
