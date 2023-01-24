// scenarios for votes without involving commission

import { assert, expect } from "chai";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
//@ts-ignore
import { ethers, deployments, SignerWithAddress } from "hardhat"

import { CONTRACTS, VOTING_DELAY, VOTING_PERIOD, MIN_DELAY } from "../config/consts.json"
import {ProposalState, VoteType} from "../config/enums"

describe("Successful vote", function() {
    let unit: Contract
    let governor: Contract
    let token: Contract
    const description = "proposal description"
    const descriptionHash = ethers.utils.id(description)
    let addresses: SignerWithAddress[]

    before(async function () {
        addresses = await ethers.getSigners();
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
            await token.transfer(addresses[i].address, supply.div(addresses.length))
        }
    })

    it("Voted for", async function() {
        assert.equal(await unit.getState(), "")
        const encodedChangeState = unit.interface.encodeFunctionData("changeState", ["new state"])
        const proposalTx = await governor.propose([unit.address], [0], [encodedChangeState], description)
        const proposeReceipt = await proposalTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        assert.equal(await governor.state(proposalId), ProposalState.Pending)
        const votePromise = governor.castVoteWithReason(proposalId, 1, "voted for")
        await expect(votePromise).to.be.revertedWith("Governor: vote not currently active")
        
        await mine(VOTING_DELAY)
        assert.equal(await governor.state(proposalId), ProposalState.Active)
        for (let i = 0; i < 3; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.For, "voted for")
        }
        for (let i = 3; i < 4; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Against, "voted against")
        }
        assert.equal(await governor.state(proposalId), ProposalState.Active)

        await mine(VOTING_PERIOD)
        assert.equal(await governor.state(proposalId), ProposalState.Succeeded)

        assert.equal(await governor.isCommissionNeeded(proposalId), false)
        assert.equal(await governor.noNeedInValidation(proposalId), true)

        await expect(governor.execute([unit.address], [0], [encodedChangeState], descriptionHash)).to.be.revertedWith("TimelockController: operation is not ready")

        await governor.queue([unit.address], [0], [encodedChangeState], descriptionHash)

        await mine(MIN_DELAY)
        await governor.execute([unit.address], [0], [encodedChangeState], descriptionHash)
        assert.equal(await unit.getState(), "new state")
        assert.equal(await governor.state(proposalId), ProposalState.Executed)
    })

    it("Voted against", async function() {
        assert.equal(await unit.getState(), "")
        const encodedChangeState = unit.interface.encodeFunctionData("changeState", ["new state"])
        const proposalTx = await governor.propose([unit.address], [0], [encodedChangeState], description)
        const proposeReceipt = await proposalTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        assert.equal(await governor.state(proposalId), ProposalState.Pending)
        const votePromise = governor.castVoteWithReason(proposalId, 1, "voted for")
        await expect(votePromise).to.be.revertedWith("Governor: vote not currently active")
        
        await mine(VOTING_DELAY)
        assert.equal(await governor.state(proposalId), ProposalState.Active)
        
        for (let i = 0; i < 3; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.Against, "voted against")
        }
        for (let i = 3; i < 4; ++i) {
            await governor.connect(addresses[i]).castVoteWithReason(proposalId, VoteType.For, "voted for")
        }
        assert.equal(await governor.state(proposalId), ProposalState.Active)

        await mine(VOTING_PERIOD)
        assert.equal(await governor.state(proposalId), ProposalState.Defeated)
        assert.equal(await governor.isCommissionNeeded(proposalId), false)
        assert.equal(await governor.noNeedInValidation(proposalId), true)
        
        await expect(governor.queue([unit.address], [0], [encodedChangeState], descriptionHash)).to.be.revertedWith("Governor: proposal not successful")
        await expect(governor.execute([unit.address], [0], [encodedChangeState], descriptionHash)).to.be.revertedWith("Governor: proposal not successful")
        assert.equal(await unit.getState(), "")

        assert.equal(await governor.state(proposalId), ProposalState.Defeated)
    })
})