// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981, IERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ERC721URIStorage, ERC721, IERC721, IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IExecutionDelegate} from "../interfaces/IExecutionDelegate.sol";

/**
 * @title SuperChief Maketplace NFT Standard
 * @dev use ERC721URIStorage standard
 */
contract SuperChiefERC721 is ERC721URIStorage, ERC2981, Ownable {
  /// @dev collection params
  string public contractURI;

  /// @dev address public executionDelegate
  IExecutionDelegate public executionDelegate;

  /// @dev fires when contract uri changed
  event ContractURIChanged(string _contractURI);
  /**
   * @dev Emitted when `value` tokens of token type `id` are transferred from `from` to `to` by `operator`.
   */
  event SuperChiefTransferSingle(
    address indexed from,
    address indexed to,
    uint256 firstTokenId,
    uint256 batchSize
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
  ) ERC721(_name, _symbol) {
    executionDelegate = IExecutionDelegate(_executionDelegate);

    setContractURI(_contractURI);
  }

  modifier onlyWhitelistedContract() {
    require(
      !_isContract(msg.sender) ||
        msg.sender == address(executionDelegate) ||
        executionDelegate.contracts(msg.sender),
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
  ) public view virtual override(ERC2981, ERC721URIStorage) returns (bool) {
    return
      interfaceId == type(IERC721).interfaceId ||
      interfaceId == type(IERC721Metadata).interfaceId ||
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
    address from,
    address to,
    uint256 firstTokenId,
    uint256 batchSize
  ) internal override onlyWhitelistedContract {
    emit SuperChiefTransferSingle(from, to, firstTokenId, batchSize);
  }
}
