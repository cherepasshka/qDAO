import { assert, expect } from "chai";
// @ts-ignore
import { ethers, deployments, SignerWithAddress } from "hardhat"
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import { CONTRACTS, VOTING_DELAY, VOTING_PERIOD, MIN_DELAY, ZERO_ADDRESS } from "../../config/consts.json"
import { CommissionType, getCommission } from "../../config/commission";
import { CommissionState, ProposalState, VoteType } from "../../config/enums";

describe("QDAO commission change via commission", function() {
    let governor: Contract
    let token: Contract
    let addresses: SignerWithAddress[]
    let commission: CommissionType

    beforeEach(async function () {
        await deployments.fixture(["all"])
        governor = await ethers.getContract(CONTRACTS.Governor)
        token = await ethers.getContract(CONTRACTS.GovernanceToken)
        addresses = await ethers.getSigners();
        commission = await getCommission();

        for (let i = 1; i < addresses.length; ++i) {
            await token.connect(addresses[i]).delegate(addresses[i].address)
        }
        let supply = await token.totalSupply()
        for (let i = 1; i < addresses.length; ++i) {
            await token.transfer(addresses[i].address, supply.div(addresses.length * 10))
        }
    })
    it("Add member to the commission via commission", async function() {
        const description = "add member"
        const encodedFunc = governor.interface.encodeFunctionData("addCommissionMember", [ZERO_ADDRESS])
        const descriptionHash = ethers.utils.id(description)
        
        const proposalTx = await governor.propose([governor.address], [0], [encodedFunc], description)
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
            governor.validate([governor.address], [0], [encodedFunc], descriptionHash),
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
            governor.submit([governor.address], [0], [encodedFunc], descriptionHash, CommissionState.Approved, signatures),
            "Submission should be successful"
        ).not.to.be.reverted

        assert.equal(await governor.state(proposalId), ProposalState.Succeeded, "Proposal state expected to be `Succeeded`")
        assert.equal(await governor.successfulCommissionGathering(proposalId), true, "Commission gathering should be successful")
    
        await expect(
            governor.queue([governor.address], [0], [encodedFunc], descriptionHash),
            "Queueing should be successful"
        ).not.to.be.reverted
        await mine(MIN_DELAY)
        
        await expect(
            governor.execute([governor.address], [0], [encodedFunc], descriptionHash),
            "Member should be added"
        ).to.emit(governor, "CommissionMemberAdded").withArgs(ZERO_ADDRESS)

        assert.equal(await governor.state(proposalId), ProposalState.Executed)
    })

    it("Remove member to the commission via commission", async function() {
        const description = "remove member"
        const encodedFunc = governor.interface.encodeFunctionData("removeCommissionMember", [addresses[0].address])
        const descriptionHash = ethers.utils.id(description)
        
        const proposalTx = await governor.propose([governor.address], [0], [encodedFunc], description)
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
            governor.validate([governor.address], [0], [encodedFunc], descriptionHash),
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
            governor.submit([governor.address], [0], [encodedFunc], descriptionHash, CommissionState.Approved, signatures),
            "Submission should be successful"
        ).not.to.be.reverted

        assert.equal(await governor.state(proposalId), ProposalState.Succeeded, "Proposal state expected to be `Succeeded`")
        assert.equal(await governor.successfulCommissionGathering(proposalId), true, "Commission gathering should be successful")
    
        await expect(
            governor.queue([governor.address], [0], [encodedFunc], descriptionHash),
            "Queueing should be successful"
        ).not.to.be.reverted
        await mine(MIN_DELAY)
        
        await expect(
            governor.execute([governor.address], [0], [encodedFunc], descriptionHash),
            "Member should be removed"
        ).to.emit(governor, "CommissionMemberRemoved").withArgs(addresses[0].address)

        assert.equal(await governor.state(proposalId), ProposalState.Executed)
    })
})

describe("QDAO commission change via vote", function() {
    let governor: Contract
    let token: Contract
    let addresses: SignerWithAddress[]

    beforeEach(async function () {
        await deployments.fixture(["all"])
        governor = await ethers.getContract(CONTRACTS.Governor)
        token = await ethers.getContract(CONTRACTS.GovernanceToken)
        addresses = await ethers.getSigners();

        for (let i = 1; i < addresses.length; ++i) {
            await token.connect(addresses[i]).delegate(addresses[i].address)
        }
        let supply = await token.totalSupply()
        for (let i = 1; i < addresses.length; ++i) {
            await token.transfer(addresses[i].address, supply.div(addresses.length))
        }
    })
    it("Add member to the commission via vote", async function() {
        const description = "add member"
        const encodedFunc = governor.interface.encodeFunctionData("addCommissionMember", [ZERO_ADDRESS])
        const descriptionHash = ethers.utils.id(description)
        
        const proposalTx = await governor.propose([governor.address], [0], [encodedFunc], description)
        const proposeReceipt = await proposalTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        await mine(VOTING_DELAY)
        for (let i = 0; i < 3; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.For, "voted for")
        }
        for (let i = 3; i < 4; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Abstain, "abstain")
        }
        await mine(VOTING_PERIOD)

        // start validating
        await expect(
            governor.validate([governor.address], [0], [encodedFunc], descriptionHash),
            "Validation should be successful"
        ).not.to.be.reverted

        assert.equal(await governor.state(proposalId), ProposalState.Succeeded, "Proposal state expected to be `Succeeded`")
    
        await expect(
            governor.queue([governor.address], [0], [encodedFunc], descriptionHash),
            "Queueing should be successful"
        ).not.to.be.reverted
        await mine(MIN_DELAY)
        
        await expect(
            governor.execute([governor.address], [0], [encodedFunc], descriptionHash),
            "Member should be added"
        ).to.emit(governor, "CommissionMemberAdded").withArgs(ZERO_ADDRESS)

        assert.equal(await governor.state(proposalId), ProposalState.Executed)
    })

    it("Remove member to the commission via vote", async function() {
        const description = "remove member"
        const encodedFunc = governor.interface.encodeFunctionData("removeCommissionMember", [addresses[0].address])
        const descriptionHash = ethers.utils.id(description)
        
        const proposalTx = await governor.propose([governor.address], [0], [encodedFunc], description)
        const proposeReceipt = await proposalTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        await mine(VOTING_DELAY)
        for (let i = 1; i < 3; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.For, "voted for")
        }
        for (let i = 3; i < 4; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Abstain, "abstain")
        }
        await mine(VOTING_PERIOD)

        // start validating
        await expect(
            governor.validate([governor.address], [0], [encodedFunc], descriptionHash),
            "Validation should be successful"
        ).not.to.be.reverted

        assert.equal(await governor.state(proposalId), ProposalState.Succeeded, "Proposal state expected to be `Succeeded`")
    
        await expect(
            governor.queue([governor.address], [0], [encodedFunc], descriptionHash),
            "Queueing should be successful"
        ).not.to.be.reverted
        await mine(MIN_DELAY)
        
        await expect(
            governor.execute([governor.address], [0], [encodedFunc], descriptionHash),
            "Member should be removed"
        ).to.emit(governor, "CommissionMemberRemoved").withArgs(addresses[0].address)

        assert.equal(await governor.state(proposalId), ProposalState.Executed)
    })
})