// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC2981, IERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ERC1155Holder, ERC1155Receiver, IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ERC1155URIStorage, ERC1155, IERC1155, IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import {IExecutionDelegate} from "../interfaces/IExecutionDelegate.sol";

/**
 * @title SuperChief Maketplace NFT Standard
 * @dev use ERC1155URIStorage standard
 */
contract SuperChiefERC1155 is ERC1155URIStorage, ERC1155Holder, ERC2981, Ownable {
  /// @dev collection params
  string public name;
  string public symbol;
  string public contractURI;

  mapping(uint256 => mapping(address => uint256)) private _listingBalances;

  /// @dev address public executionDelegate
  IExecutionDelegate public executionDelegate;

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
  ) public view virtual override(ERC2981, ERC1155, ERC1155Receiver) returns (bool) {
    return
      interfaceId == type(IERC1155).interfaceId ||
      interfaceId == type(IERC1155MetadataURI).interfaceId ||
      interfaceId == type(IERC2981).interfaceId ||
      interfaceId == type(IERC1155Receiver).interfaceId ||
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

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal override onlyWhitelistedContract {
    if (ids.length == 1) {
      emit SuperChiefTransferSingle(operator, from, to, ids[0], amounts[0]);
    } else {
      emit SuperChiefTransferBatch(operator, from, to, ids, amounts);
    }
  }

  function _mint(
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) internal virtual override {
    super._mint(address(this), id, amount, data);
    _listingBalances[id][to] += amount;
  }

  function _safeTransferFrom(
    address from,
    address to,
    uint256 id,
    uint256 amount,
    bytes memory data
  ) internal virtual override {
    if (_listingBalances[id][from] >= amount) {
      require(
        from == _msgSender() || isApprovedForAll(from, _msgSender()),
        "ERC1155: caller is not token owner or approved"
      );
      super._safeTransferFrom(address(this), to, id, amount, data);
      unchecked {
        _listingBalances[id][from] -= amount;
      }
    } else {
      super._safeTransferFrom(from, to, id, amount, data);
    }
  }
}
