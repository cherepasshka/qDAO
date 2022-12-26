// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

// unit which will be governed by smart contract
contract Unit is Ownable {
    string private state;

    function changeState(string memory newState) public onlyOwner {
        state = newState;
    }

    function getState() public view returns (string memory) {
        return state;
    }
}