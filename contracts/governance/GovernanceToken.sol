// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract GovernanceToken is ERC20Votes {
    uint256 public maxSupply = 1000 * 1000 * 1000000000000000000; // 10^6 eth

    constructor() ERC20("qDAOGovernanceToken", "qGT") ERC20Permit("qDAOGovernanceToken") {
        _mint(msg.sender, maxSupply);
    }

    function transfer(address destination, uint256 amount) public override virtual returns(bool){
        if (destination != address(0)) {
            require(delegates(destination) != address(0), "Before moving voting power to some address delegate it");
        }
        if (msg.sender != address(0)) {
            require(delegates(msg.sender) != address(0), "Before moving voting power from some address delegate it");
        }
        return super.transfer(destination, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20Votes) {
        super._burn(account, amount);
    }
}