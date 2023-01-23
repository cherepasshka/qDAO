import { assert, expect } from "chai";
// @ts-ignore
import { ethers, deployments } from "hardhat"
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { Contract } from "ethers";
import {CONTRACTS, VOTING_DELAY} from '../config/consts.json'

describe("Government validity", function() {
    let unit: Contract
    let governor: Contract
    beforeEach(async function () {
        await deployments.fixture(["all"])
        unit = await ethers.getContract(CONTRACTS.Unit)
        governor = await ethers.getContract(CONTRACTS.Governor)
    })
    it("Ownership", async function() {
        await expect(unit.changeState("new state")).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("Unknown proposal", async function() {
        const encodedFunction = unit.interface.encodeFunctionData("changeState", ["new state"])
        const descriptionHash = ethers.utils.id("some description")
        let funcCallPromise = governor.execute([unit.address], [0], [encodedFunction], descriptionHash)
        await expect(funcCallPromise).to.be.revertedWith("Governor: unknown proposal id")
    })

    it("No double votes", async function() {
        assert.equal(await unit.getState(), "")
        const encodedChangeState = unit.interface.encodeFunctionData("changeState", ["new state"])
        const proposalTx = await governor.propose([unit.address], [0], [encodedChangeState], "description")
        const proposeReceipt = await proposalTx.wait(1)
        const proposalId = proposeReceipt.events![0].args!.proposalId
        
        await mine(VOTING_DELAY)
        await governor.castVoteWithReason(proposalId, 1, "voted for")
        await expect(governor.castVoteWithReason(proposalId, 1, "voted for")).to.be.revertedWith("GovernorVotingSimple: vote already cast")
    })
})