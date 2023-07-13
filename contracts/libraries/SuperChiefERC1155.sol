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

  /// @dev address public executionDelegate
  address public executionDelegate;

  /// @dev fires when contract uri changed
  event ContractURIChanged(string _contractURI);
  /**
   * @dev Emitted when `value` tokens of token type `id` are transferred from `from` to `to` by `operator`.
   */
  event SuperChiefTransferSingle(
    address indexed operator,
    address indexed from,
    address indexed to,
    uint256 id,
    uint256 value
  );

  /**
   * @dev Equivalent to multiple {SuperChief} events, where `operator`, `from` and `to` are the same for all
   * transfers.
   */
  event SuperChiefTransferBatch(
    address indexed operator,
    address indexed from,
    address indexed to,
    uint256[] ids,
    uint256[] values
  );

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
   * @param _contractURI uri of contract
   * @param _executionDelegate execution delegate address
   */
  constructor(
    string memory _name,
    string memory _symbol,
    string memory _contractURI,
    address _executionDelegate
  ) ERC1155("") {
    name = _name;
    symbol = _symbol;
    executionDelegate = _executionDelegate;

    setContractURI(_contractURI);

    emit SuperChiefCollectionCreated(address(this), name, symbol, contractURI, msg.sender);
  }

  modifier onlyExecutionDelegate() {
    require(
      !_isContract(msg.sender) || msg.sender == executionDelegate,
      "SuperChiefCollection: invalid executor"
    );
    _;
  }

  function _isContract(address _addr) private view returns (bool isContract) {
    uint32 size;
    assembly {
      size := extcodesize(_addr)
    }
    return (size > 0);
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

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal override onlyExecutionDelegate {
    if (ids.length == 1) {
      emit SuperChiefTransferSingle(operator, from, to, ids[0], amounts[0]);
    } else {
      emit SuperChiefTransferBatch(operator, from, to, ids, amounts);
    }
  }
}
