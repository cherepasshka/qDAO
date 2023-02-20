import { assert, expect } from "chai";
// @ts-ignore
import { ethers, deployments } from "hardhat"
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import {CONTRACTS, VOTING_DELAY, ZERO_ADDRESS} from '../config/consts.json'

describe("Government validity", function() {
    let unit: Contract
    let governor: Contract
    let token: Contract
    beforeEach(async function () {
        await deployments.fixture(["all"])
        unit = await ethers.getContract(CONTRACTS.Unit)
        governor = await ethers.getContract(CONTRACTS.Governor)
        token = await ethers.getContract(CONTRACTS.GovernanceToken)
    })
    it("Ownership", async function() {
        await expect(
            unit.changeState("new state"),
            "Straight execution should fail"
        ).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(
            governor.addCommissionMember(ZERO_ADDRESS),
            "Straight execution should fail"
        ).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(
            governor.removeCommissionMember(ZERO_ADDRESS),
            "Straight execution should fail"
        ).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("Unknown proposal", async function() {
        const encodedFunction = unit.interface.encodeFunctionData("changeState", ["new state"])
        const descriptionHash = ethers.utils.id("some description")
        let funcCallPromise = governor.execute([unit.address], [0], [encodedFunction], descriptionHash)
        await expect(
            funcCallPromise,
            "Execution should fail"
        ).to.be.revertedWith("Governor: unknown proposal id")
    })

    it("No double votes", async function() {
        assert.equal(await unit.getState(), "")
        const encodedChangeState = unit.interface.encodeFunctionData("changeState", ["new state"])
        const proposalTx = await governor.propose([unit.address], [0], [encodedChangeState], "description")
        const proposeReceipt = await proposalTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        
        await mine(VOTING_DELAY)
        await governor.castVoteWithReason(proposalId, 1, "voted for")
        await expect(
            governor.castVoteWithReason(proposalId, 1, "voted for"),
            "Duplicate vote should fail"
        ).to.be.revertedWith("GovernorVotingSimple: vote already cast")
    })

    it("Fail to transfer without delegation", async function() {
        const addresses = await ethers.getSigners();
        await expect(
            token.transfer(addresses[1].address, 1),
            "Transfer without delegating should fail"
        ).to.be.revertedWith("Before moving voting power to some address delegate it")
        await expect(
            token.connect(addresses[1]).delegate(addresses[1].address),
            "Delegating should be successful"
        ).not.to.be.reverted
        await expect(
            token.transfer(addresses[1].address, 1),
            "Transfering should be successful"
        ).not.to.be.reverted
    })
})