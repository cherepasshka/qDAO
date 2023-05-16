// scenarios for votes with involving commission

import { assert, expect } from "chai";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
//@ts-ignore
import { ethers, deployments, SignerWithAddress } from "hardhat"

import { CONTRACTS, VOTING_DELAY, VOTING_PERIOD, MIN_DELAY } from "../../config/consts.json"
import { CommissionType, getCommission } from "../../config/commission";
import { CommissionState, ProposalState, VoteType } from "../../config/enums";

describe("Crisis handling", function() {
    let unit: Contract
    let governor: Contract
    let token: Contract
    const description = "proposal description"
    const descriptionHash = ethers.utils.id(description)
    let addresses: SignerWithAddress[]
    let commission: CommissionType

    before(async function () {
        addresses = await ethers.getSigners();
        commission = await getCommission("hardhat");
    })

    beforeEach(async function () {
        await deployments.fixture(["all"])
        unit = await ethers.getContract(CONTRACTS.Unit)
        governor = await ethers.getContract(CONTRACTS.Governor)
        token = await ethers.getContract(CONTRACTS.GovernanceToken)
        // distribution tokens among addresses:
        for (let i = 1; i < addresses.length; ++i) {
            await token.connect(addresses[i]).delegate(addresses[i].address)
        }
        let supply = await token.totalSupply()
        for (let i = 1; i < addresses.length; ++i) {
            await token.transfer(addresses[i].address, supply.div(addresses.length * 10))
        }
    })

    it("Quorum not reached, fail to execute without commission", async function() {
        const encodedChangeState = unit.interface.encodeFunctionData("changeState", ["new state"])
        const proposalTx = await governor.propose([unit.address], [0], [encodedChangeState], description)
        const proposeReceipt = await proposalTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        assert.equal(await governor.state(proposalId), ProposalState.Pending, "Proposal state expected to be `Pending`")
        await mine(VOTING_DELAY)
        for (let i = 1; i < 3; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Against, "voted against")
        }
        for (let i = 3; i < 6; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Abstain, "abstain")
        }
        assert.equal(await governor.state(proposalId), ProposalState.Active, "Proposal state expected to be `Active`")
        await mine(VOTING_PERIOD)
        assert.equal(await governor.state(proposalId), ProposalState.Defeated, "Proposal state expected to be `Defeated`")
        assert.equal(await governor.isCommissionNeeded(proposalId), true, "Commission gathering expected to be neccessary")
        assert.equal(await governor.noNeedInValidation(proposalId), false, "Proposal is not ready for execution")
        await expect(
            governor.execute([unit.address], [0], [encodedChangeState], descriptionHash),
            "The need for validation"
        ).to.be.revertedWith("Proposal need validation")
    })

    it("Quorum not reached, commission approved", async function() {
        const encodedChangeState = unit.interface.encodeFunctionData("changeState", ["new state"])
        const proposalTx = await governor.propose([unit.address], [0], [encodedChangeState], description)
        const proposeReceipt = await proposalTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        await mine(VOTING_DELAY)
        for (let i = 1; i < 3; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Against, "voted against")
        }
        for (let i = 3; i < 6; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Abstain, "abstain")
        }
        await mine(VOTING_PERIOD)

        // start validating
        await expect(
            governor.validate([unit.address], [0], [encodedChangeState], descriptionHash),
            "Validation should be successful"
        ).not.to.be.reverted

        // sign proposalId by every commission member
        let signatures: string[] = new Array();
        let hash =  await governor.decisionHash(proposalId, CommissionState.Approved);
        for (let i = 0; i < commission.members.length; ++i) {
            let signedDecision = await commission.members[i].signMessage(ethers.utils.arrayify(hash))
            signatures.push(signedDecision)
        }

        assert.equal(await governor.successfulCommissionGathering(proposalId), false, "Commission gathering should be in process")
        // submit decision
        await expect(
            governor.submit([unit.address], [0], [encodedChangeState], descriptionHash, CommissionState.Approved, signatures),
            "Submission should be successful"
        ).not.to.be.reverted

        assert.equal(await governor.state(proposalId), ProposalState.Succeeded, "Proposal state expected to be `Succeeded`")
        assert.equal(await governor.successfulCommissionGathering(proposalId), true, "Commission gathering should be successful")
    
        await expect(
            governor.queue([unit.address], [0], [encodedChangeState], descriptionHash),
            "Queueing should be successful"
        ).not.to.be.reverted
        await mine(MIN_DELAY)
        await expect(
            governor.execute([unit.address], [0], [encodedChangeState], descriptionHash),
            "Execution should be successful"
        ).not.to.be.reverted

        assert.equal(await unit.getState(), "new state")
        assert.equal(await governor.state(proposalId), ProposalState.Executed)
    })

    it("Quorum not reached, commission declined", async function() {
        const encodedChangeState = unit.interface.encodeFunctionData("changeState", ["new state"])
        const proposalTx = await governor.propose([unit.address], [0], [encodedChangeState], description)
        const proposeReceipt = await proposalTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        await mine(VOTING_DELAY)
        for (let i = 1; i < 3; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Against, "voted against")
        }
        for (let i = 3; i < 6; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Abstain, "abstain")
        }
        await mine(VOTING_PERIOD)

        // start validating
        await expect(
            governor.validate([unit.address], [0], [encodedChangeState], descriptionHash), 
            "Validation should be successful"
        ).not.to.be.reverted

        // sign proposalId by every commission member
        let signatures: string[] = new Array();
        let hash =  await governor.decisionHash(proposalId, CommissionState.Declined);
        for (let i = 0; i < commission.members.length; ++i) {
            let signedDecision = await commission.members[i].signMessage(ethers.utils.arrayify(hash))
            signatures.push(signedDecision)
        }

        assert.equal(await governor.successfulCommissionGathering(proposalId), false, "Commission gathering should be in process")
        // submit decision
        await expect(
            governor.submit([unit.address], [0], [encodedChangeState], descriptionHash, CommissionState.Declined, signatures),
            "Submission should be successful"
        ).not.to.be.reverted

        assert.equal(await governor.successfulCommissionGathering(proposalId), true, "Commission gathering should be successful")
        assert.equal(await governor.state(proposalId), ProposalState.Defeated, "Proposal state expected to be `Defeated`")

        await expect(
            governor.queue([unit.address], [0], [encodedChangeState], descriptionHash),
            "Queueing should fail"
        ).to.be.revertedWith("Governor: proposal not successful")

        assert.equal(await unit.getState(), "")
    })
})