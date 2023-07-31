// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {SuperChiefERC721} from "../libraries/SuperChiefERC721.sol";
import {Sig} from "../libraries/Structs.sol";

/**
 * @title SuperChief Exhibition contract
 * @dev use ERC721URIStorage standard
 */
contract ERC721Exhibition is SuperChiefERC721 {
  /// @dev current max token id
  uint256 public maxId;

  /// @dev signer address
  address public signer;

  event SuperChiefExhibitonCreated(
    address indexed exhibition,
    string name,
    string symbol,
    string contractURI,
    address owner
  );
  event SuperChiefNftMinted(uint256 tokenId, address owner, uint256 amount, string tokenUri);
  event SignerUpdated(address indexed signer);

  /**
   * @dev sets contract params
   * @param _name name of collection
   * @param _symbol symbol of collection
   * @param _contractURI uri of contract
   * @param _signer signer address
   * @param _executionDelegate addres of execution delegate
   */
  constructor(
    string memory _name,
    string memory _symbol,
    string memory _contractURI,
    address _signer,
    address _executionDelegate
  ) SuperChiefERC721(_name, _symbol, _contractURI, _executionDelegate) {
    signer = _signer;
    emit SuperChiefExhibitonCreated(address(this), _name, _symbol, _contractURI, msg.sender);
    emit SignerUpdated(signer);
  }

  /// @notice updates signer
  function updateSigner(address _signer) external onlyOwner {
    signer = _signer;

    emit SignerUpdated(signer);
  }

  /**
   * @notice mints token to address by amount with tokenUri
   * @param to owner of NFT
   * @param tokenUri uri of NFT
   * @param sig signature of signer
   */
  function mint(address to, string calldata tokenUri, Sig calldata sig) external returns (uint256) {
    require(_validateMintSign(to, sig), "Invalid signature");
    maxId++;

    _mint(to, maxId);
    _setTokenURI(maxId, tokenUri);

    emit SuperChiefNftMinted(maxId, to, 1, tokenUri);

    return maxId;
  }

  /// @dev validate signer signature
  function _validateMintSign(address to, Sig calldata sig) private view returns (bool) {
    bytes32 messageHash = keccak256(abi.encodePacked(_msgSender(), to, address(this)));

    bytes32 ethSignedMessageHash = keccak256(
      abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
    );

    return signer == ecrecover(ethSignedMessageHash, sig.v, sig.r, sig.s);
  }
}
