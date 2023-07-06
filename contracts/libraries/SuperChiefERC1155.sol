// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981, IERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ERC1155URIStorage, ERC1155, IERC1155, IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";

/**
 * @title SuperChief Maketplace NFT Standard
 * @dev use ERC1155URIStorage standard
 */
contract SuperChiefERC1155 is ERC1155URIStorage, ERC2981, Ownable {
  /// @dev collection params
  string public name;
  string public symbol;
  string public contractURI;

  /// @dev current max token id
  uint256 public maxId;

  /// @dev fires when contract uri changed
  event ContractURIChanged(string _contractURI);
  /**
   * @dev Emitted when `value` tokens of token type `id` are transferred from `from` to `to` by `operator`.
   */
  event SuperChief_TransferSingle(
    address indexed operator,
    address indexed from,
    address indexed to,
    uint256 id,
    uint256 value
  );

  /**
   * @dev Equivalent to multiple {TransferSingle} events, where `operator`, `from` and `to` are the same for all
   * transfers.
   */
  event SuperChief_TransferBatch(
    address indexed operator,
    address indexed from,
    address indexed to,
    uint256[] ids,
    uint256[] values
  );

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

  /// @dev emit custom events of SuperChief platform
  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal override {
    if (ids.length == 1) {
      emit SuperChief_TransferSingle(operator, from, to, ids[0], amounts[0]);
    } else {
      emit SuperChief_TransferBatch(operator, from, to, ids, amounts);
    }
  }
}
