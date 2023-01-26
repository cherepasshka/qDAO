// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

import "../SignatureHandler.sol";

contract QDAOGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorVotesQuorumFraction, GovernorTimelockControl {
    enum CommissionState {
        Pending,
        Approved,
        Declined
    }
    struct DecisionCore {
        bool createdGathering;
        bool finishedGathering;
        CommissionState state;
    }
    struct CommissionCore {
        address[] members;
        address collectiveDecisionSource;
        uint256 requiredSignatures;
    }

    mapping(uint256 => DecisionCore) private commissionSolution;
    CommissionCore private commission;
    SignatureHandler private verifier;

    constructor(
        IVotes _token, 
        TimelockController _timelock, 
        uint256 _votingDelay, // delay since proposal is created until voting starts, measured in blocks
        uint256 _votingPeriod, // measured in blocks
        uint256 _proposalThreshold, // minimum number of votes an account must have to create a proposal
        uint256 _quorumFraction,
        CommissionCore memory _commission
    )
        Governor("qDAO")
        GovernorSettings(_votingDelay, _votingPeriod, _proposalThreshold)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorumFraction)
        GovernorTimelockControl(_timelock)
    {
        commission = _commission;
        verifier = new SignatureHandler();
    }
    
    function execute(
        address[] memory targets,
        uint256[] memory values, // amount of ethers to pay for each target
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable override(IGovernor, Governor) returns (uint256) {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        require(noNeedInValidation(proposalId), "Proposal need validation");
        return super.execute(targets, values, calldatas, descriptionHash);
    }

    function validate(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        if (isCommissionNeeded(proposalId)) {
            require(!commissionSolution[proposalId].createdGathering, "Commission gathering was already created");
            commissionSolution[proposalId].createdGathering = true;
            // emits commission gathering and changes approval state of proposal due to commission decision
        }
    }

    function submit(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash,
        CommissionState decision,
        bytes[] memory signatures
    ) public {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        require(isCommissionNeeded(proposalId), "No need for commission solution");
        require(commissionSolution[proposalId].createdGathering, "No commission gathering was created");
        require(!commissionSolution[proposalId].finishedGathering, "Commission has already submited the solution");

        require(msg.sender == commission.collectiveDecisionSource, "Only commission can make decision on the crisis issue");
        
        // validates that there enough commission members signatures
        bytes32 ethSignedDecision = verifier.getEthSignedMessageHash(decisionHash(proposalId, decision));
        _verifySignatures(ethSignedDecision, signatures);
        require(signatures.length >= commission.requiredSignatures, "Not enough signatures");
        commissionSolution[proposalId].state = decision;
        commissionSolution[proposalId].finishedGathering = true;
    }

    function decisionHash(
        uint256 proposalId,
        CommissionState decision
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(proposalId, decision));
    }

    function _verifySignatures(bytes32 ethSignedMessageHash, bytes[] memory signatures) private view {
        address[] memory signers = new address[](signatures.length);
        for(uint i = 0; i < signatures.length; ++i) {
            signers[i] = verifier.recoverSignerBySignature(ethSignedMessageHash, signatures[i]);
            require(_isCommissionMember(signers[i]), "One of signatures is invalid");
        }
        // todo: require no duplicates
    }

    function _isCommissionMember(address source) private view returns(bool) {
        for (uint i = 0; i < commission.members.length; ++i) {
            if (source == commission.members[i]) {
                return true;
            }
        }
        return false;
    }

    function successfulCommissionGathering(uint256 proposalId) public view returns(bool) {
        return commissionSolution[proposalId].createdGathering && commissionSolution[proposalId].finishedGathering;
    }

    function noNeedInValidation(uint256 proposalId) public view returns(bool) {
        return (isCommissionNeeded(proposalId) && successfulCommissionGathering(proposalId))
                || !isCommissionNeeded(proposalId);
    }

    function isCommissionNeeded(uint256 proposalId) public view returns(bool) {
        return !super._quorumReached(proposalId) && state(proposalId) == ProposalState.Defeated;
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState) {
        ProposalState voteState = super.state(proposalId);
        if (voteState == ProposalState.Defeated && !super._quorumReached(proposalId) && successfulCommissionGathering(proposalId)) {
            if (commissionSolution[proposalId].state == CommissionState.Approved) {
                return ProposalState.Succeeded;
            } else if (commissionSolution[proposalId].state == CommissionState.Declined) {
                return ProposalState.Defeated;
            }
        }
        return voteState;
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