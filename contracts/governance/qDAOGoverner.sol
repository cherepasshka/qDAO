// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

import {SignatureHandle} from "../lib/SignatureHandle.sol";
import {Commission} from "../lib/Commission.sol";

contract QDAOGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorVotesQuorumFraction, GovernorTimelockControl {
    event CommissionGatheringCreated(uint256 proposalId, Commission.Core commission);
    event CommissionGatheringFinished(uint256 proposalId, Commission.Core commission, Commission.State solution);

    struct DecisionCore {
        bool createdGathering;
        bool finishedGathering;
        Commission.State state;
    }

    mapping(address => bool) private _exist;
    mapping(uint256 => DecisionCore) private commissionSolution;
    Commission.Core private commission;
    address private _owner;

    constructor(
        IVotes _token, 
        TimelockController _timelock, 
        uint256 _votingDelay, // delay since proposal is created until voting starts, measured in blocks
        uint256 _votingPeriod, // measured in blocks
        uint256 _proposalThreshold, // minimum number of votes an account must have to create a proposal
        uint256 _quorumFraction,
        Commission.Core memory _commission
    )
        Governor("qDAO")
        GovernorSettings(_votingDelay, _votingPeriod, _proposalThreshold)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorumFraction)
        GovernorTimelockControl(_timelock)
    {
        commission = _commission;
        _owner = address(_timelock);
    }
    
    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }

    function removeCommissionMember(address member) public onlyOwner virtual returns (bool) {
        uint length = commission.members.length;
        for (uint i = 0; i < length; ++i) {
            if (member == commission.members[i]) {
                commission.members[i] = commission.members[length - 1];
                commission.members.pop();
                emit Commission.MemberRemoved(member);
                return true;
            }
        }
        return false;
    }

    function addCommissionMember(address member) public onlyOwner virtual returns (bool) {
        if (Commission.isMember(commission, member)) {
            return false;
        }
        commission.members.push(member);
        emit Commission.MemberAdded(member);
        return true;
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
            
            emit CommissionGatheringCreated(proposalId, commission);
        }
    }

    function submit(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash,
        Commission.State decision,
        bytes[] memory signatures
    ) public {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        require(isCommissionNeeded(proposalId), "No need for commission solution");
        require(commissionSolution[proposalId].createdGathering, "No commission gathering was created");
        require(!commissionSolution[proposalId].finishedGathering, "Commission has already submited the solution");

        require(msg.sender == commission.collectiveDecisionSource, "Only commission can make decision on the crisis issue");
        
        // validates that there enough commission members signatures
        bytes32 ethSignedDecision = SignatureHandle.getEthSignedMessageHash(decisionHash(proposalId, decision));
        _verifySignatures(ethSignedDecision, signatures);
        require(signatures.length >= commission.requiredSignatures, "Not enough signatures");
        commissionSolution[proposalId].state = decision;
        commissionSolution[proposalId].finishedGathering = true;

        emit CommissionGatheringFinished(proposalId, commission, decision);
    }

    function decisionHash(
        uint256 proposalId,
        Commission.State decision
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(proposalId, decision));
    }

    function _verifySignatures(bytes32 ethSignedMessageHash, bytes[] memory signatures) private {
        address[] memory signers = new address[](signatures.length);
        for(uint i = 0; i < signatures.length; ++i) {
            signers[i] = SignatureHandle.recoverSignerBySignature(ethSignedMessageHash, signatures[i]);
            require(Commission.isMember(commission, signers[i]), "One of signatures is invalid");
        }
        bool duplicate = false;
        for (uint i = 0; i < signers.length; ++i) {
            if (_exist[signers[i]]) {
                duplicate = true;
                break;
            }
            _exist[signers[i]] = true;
        }
        for (uint i = 0; i < signers.length; ++i) {
            _exist[signers[i]] = false;
        }
        require(!duplicate, "Duplicates found in signatures");
    }

    function successfulCommissionGathering(uint256 proposalId) public view returns(bool) {
        return commissionSolution[proposalId].createdGathering && commissionSolution[proposalId].finishedGathering;
    }

    function noNeedInValidation(uint256 proposalId) public view returns(bool) {
        return (isCommissionNeeded(proposalId) && successfulCommissionGathering(proposalId))
                || !isCommissionNeeded(proposalId);
    }

    function _votedEnough(uint256 proposalId) private view returns(bool) {
        (uint256 votesAgainst, uint256 votesFor, uint256 votesAbstaint) = proposalVotes(proposalId);
        return votesAgainst + votesFor + votesAbstaint >= quorum(proposalSnapshot(proposalId));
    }

    function isCommissionNeeded(uint256 proposalId) public view returns(bool) {
        return !_votedEnough(proposalId) && state(proposalId) == ProposalState.Defeated;
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState) {
        ProposalState voteState = super.state(proposalId);
        if (voteState == ProposalState.Defeated && !_votedEnough(proposalId) && successfulCommissionGathering(proposalId)) {
            if (commissionSolution[proposalId].state == Commission.State.Approved) {
                return ProposalState.Succeeded;
            } else if (commissionSolution[proposalId].state == Commission.State.Declined) {
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