// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Commission {
    event MemberAdded(address member);
    event MemberRemoved(address member);

    enum State {
        Pending,
        Approved,
        Declined
    }
    struct Core {
        address[] members;
        address collectiveDecisionSource;
        uint256 requiredSignatures;
    }

    function isMember(Core memory commission, address source) public pure returns(bool) {
        for (uint i = 0; i < commission.members.length; ++i) {
            if (source == commission.members[i]) {
                return true;
            }
        }
        return false;
    }
}