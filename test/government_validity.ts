import { expect } from "chai";
// @ts-ignore
import { ethers, deployments } from "hardhat"
import { Contract } from "ethers";
import {CONTRACTS} from '../config/consts.json'

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
})