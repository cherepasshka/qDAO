// scenarios for invalid uses of commission

import { assert, expect } from "chai";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
//@ts-ignore
import { ethers, deployments, SignerWithAddress } from "hardhat"
    
import { CONTRACTS, VOTING_DELAY, VOTING_PERIOD, MIN_DELAY } from "../config/consts.json"
import { CommissionType, getCommission } from "../config/commission";
import { CommissionState, ProposalState, VoteType } from "../config/enums";

/* todo:
    - more tests for noNeedInValidation
    - more tests for submit
 */

describe("Invalid commission usecases", function() {
    let unit: Contract
    let governor: Contract
    let token: Contract
    const description = "proposal description"
    const descriptionHash = ethers.utils.id(description)
    let addresses: SignerWithAddress[]
    let commission: CommissionType
    let encodedChangeState: string

    before(async function () {
        addresses = await ethers.getSigners();
        commission = await getCommission();
    })

    beforeEach(async function () {
        await deployments.fixture(["all"])
        unit = await ethers.getContract(CONTRACTS.Unit)
        governor = await ethers.getContract(CONTRACTS.Governor)
        token = await ethers.getContract(CONTRACTS.GovernanceToken)
        encodedChangeState = unit.interface.encodeFunctionData("changeState", ["new state"])
        // distribution tokens among addresses:
        for (let i = 1; i < addresses.length; ++i) {
            await token.connect(addresses[i]).delegate(addresses[i].address)
        }
        let supply = await token.totalSupply()
        for (let i = 1; i < addresses.length; ++i) {
            await token.transfer(addresses[i].address, supply.div(addresses.length * 10))
        }
    })

    it("Invalid signers", async function() {
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
        await expect(governor.validate([unit.address], [0], [encodedChangeState], descriptionHash)).not.to.be.reverted

        // sign proposalId by every commission member
        let signatures: string[] = new Array();
        let hash =  await governor.decisionHash(proposalId, CommissionState.Approved);
        for (let i = commission.members.length; i < addresses.length; ++i) {
            let signedDecision = await addresses[i].signMessage(ethers.utils.arrayify(hash))
            signatures.push(signedDecision)
        }
        await expect(
            governor.submit([unit.address], [0], [encodedChangeState], descriptionHash, CommissionState.Approved, signatures)
        ).to.be.revertedWith("One of signatures is invalid")

        assert.equal(await governor.state(proposalId), ProposalState.Defeated, "Proposal state expected to be `Defeated`")
        assert.equal(await governor.successfulCommissionGathering(proposalId), false, "Commission gathering expected to be not completed")
        assert.equal(await governor.noNeedInValidation(proposalId), false, "Validation expected to be necessary")
        assert.equal(await governor.isCommissionNeeded(proposalId), true, "Commission gathering expected to be necessary")
    })

    it("Invalid signature", async function() {
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
        await expect(governor.validate([unit.address], [0], [encodedChangeState], descriptionHash)).not.to.be.reverted

        // sign proposalId by every commission member
        let signatures: string[] = new Array();
        let hash =  await governor.decisionHash(proposalId, CommissionState.Declined);
        for (let i = 0; i < commission.requiredSignatures; ++i) {
            let signedDecision = await commission.members[i].signMessage(ethers.utils.arrayify(hash))
            signatures.push(signedDecision)
        }
        await expect(
            governor.submit([unit.address], [0], [encodedChangeState], descriptionHash, CommissionState.Approved, signatures)
        ).to.be.revertedWith("One of signatures is invalid")

        assert.equal(await governor.state(proposalId), ProposalState.Defeated, "Proposal state expected to be `Defeated`")
        assert.equal(await governor.successfulCommissionGathering(proposalId), false, "Commission gathering expected to be not completed")
        assert.equal(await governor.noNeedInValidation(proposalId), false, "Validation expected to be necessary")
        assert.equal(await governor.isCommissionNeeded(proposalId), true, "Commission gathering expected to be necessary")
    })

    it("Invalid decision source address", async function() {
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
        await expect(governor.validate([unit.address], [0], [encodedChangeState], descriptionHash)).not.to.be.reverted

        // sign proposalId by every commission member
        let signatures: string[] = new Array();
        let hash =  await governor.decisionHash(proposalId, CommissionState.Declined);
        for (let i = 0; i < commission.requiredSignatures; ++i) {
            let signedDecision = await commission.members[i].signMessage(ethers.utils.arrayify(hash))
            signatures.push(signedDecision)
        }
        await expect(
            governor.connect(addresses[1]).submit([unit.address], [0], [encodedChangeState], descriptionHash, CommissionState.Approved, signatures)
        ).to.be.revertedWith("Only commission can make decision on the crisis issue")

        assert.equal(await governor.state(proposalId), ProposalState.Defeated, "Proposal state expected to be `Defeated`")
        assert.equal(await governor.successfulCommissionGathering(proposalId), false, "Commission gathering expected to be not completed")
        assert.equal(await governor.noNeedInValidation(proposalId), false, "Validation expected to be necessary")
        assert.equal(await governor.isCommissionNeeded(proposalId), true, "Commission gathering expected to be necessary")
    })

    it("Not enough signatures", async function() {
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
        await expect(governor.validate([unit.address], [0], [encodedChangeState], descriptionHash)).not.to.be.reverted

        // sign proposalId by every commission member
        let signatures: string[] = new Array();
        let hash =  await governor.decisionHash(proposalId, CommissionState.Approved);
        for (let i = 0; i < commission.requiredSignatures - 1; ++i) {
            let signedDecision = await commission.members[i].signMessage(ethers.utils.arrayify(hash))
            signatures.push(signedDecision)
        }
        await expect(
            governor.submit([unit.address], [0], [encodedChangeState], descriptionHash, CommissionState.Approved, signatures)
        ).to.be.revertedWith("Not enough signatures")

        assert.equal(await governor.state(proposalId), ProposalState.Defeated, "Proposal state expected to be `Defeated`")
        assert.equal(await governor.successfulCommissionGathering(proposalId), false, "Commission gathering expected to be not completed")
        assert.equal(await governor.noNeedInValidation(proposalId), false, "Validation expected to be necessary")
        assert.equal(await governor.isCommissionNeeded(proposalId), true, "Commission gathering expected to be necessary")
    })
})