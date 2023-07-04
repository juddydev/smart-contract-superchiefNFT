// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981, IERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ERC1155URIStorage, ERC1155, IERC1155, IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

/**
 * @title SuperChief Maketplace NFT Standard
 * @dev use ERC1155URIStorage standard
 */
contract Collection is ERC1155URIStorage, ERC2981, Ownable {
  /// @dev collection params
  string public name;
  string public symbol;
  string public contractURI;

  /// @dev current max token id
  uint256 public maxId;

  /// @dev fires when contract uri changed
  event ContractURIChanged(string _contractURI);

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
   * @notice mints token to address by amount with tokenUri
   * @param to owner of NFT
   * @param amount amount of NFT
   * @param tokenUri uri of NFT
   */
  function mint(address to, uint256 amount, string calldata tokenUri) external onlyOwner {
    maxId++;
    _mint(to, maxId, amount, "");
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
