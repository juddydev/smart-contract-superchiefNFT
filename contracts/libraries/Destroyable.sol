// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Destroyable is Ownable {
  event Destroyed();

  function destory() external onlyOwner {
    emit Destroyed();

    selfdestruct(payable(owner()));
  }
}
