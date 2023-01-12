// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

contract QDAOGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorVotesQuorumFraction, GovernorTimelockControl {
    address[] private commission;
    mapping(uint256 => bool) private approvedByCommission;

    constructor(
        IVotes _token, 
        TimelockController _timelock, 
        uint256 _votingDelay, // delay since proposal is created until voting starts, measured in blocks
        uint256 _votingPeriod, // measured in blocks
        uint256 _proposalThreshold, // minimum number of votes an account must have to create a proposal
        uint256 _quorumFraction,
        address[] memory _commission
    )
        Governor("qDAO")
        GovernorSettings(_votingDelay, _votingPeriod, _proposalThreshold)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorumFraction)
        GovernorTimelockControl(_timelock)
    {
        commission = _commission;
    }
    
    function execute(
        address[] memory targets,
        uint256[] memory values, // amount of ethers to pay
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable override(IGovernor, Governor) returns (uint256) {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        require(readyToExecute(proposalId), "Proposal is not ready for execution yet, please proceed validation first");

        return super.execute(targets, values, calldatas, descriptionHash);
    }

    function validate(
        address[] memory targets,
        uint256[] memory values, // amount of ethers to pay
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public view {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        if (isCommissionNeeded(proposalId)) {
            // emits commission gathering and changes approval state of proposal due to commission decision
        }
    }

    function readyToExecute(uint256 proposalId) public view returns(bool) {
        return (isCommissionNeeded(proposalId) && approvedByCommission[proposalId]) 
                || !isCommissionNeeded(proposalId);
    }

    function isCommissionNeeded(uint256 proposalId) public view returns(bool) {
        return !super._quorumReached(proposalId) && state(proposalId) == ProposalState.Defeated;
    }
 
    // mandatary overrides below
    function votingDelay()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesQuorumFraction)
        returns (uint256) {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState) {
        return super.state(proposalId);
    }

    function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description)
        public
        override(Governor, IGovernor)
        returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256) {
        return super.proposalThreshold();
    }

    function _execute(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address) {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}