import { expect } from "chai";
// @ts-ignore
import { ethers, deployments } from "hardhat"

import { CONTRACTS } from "../config/consts"

describe("Government validity", function() {
    beforeEach(async function () {
        await deployments.fixture(["all"])
    })
    it("Ownership", async function() {
        let unit = await ethers.getContract(CONTRACTS.Unit)
        await expect(unit.changeState("new state")).to.be.revertedWith("Ownable: caller is not the owner")
    })

    it("Unknown proposal", async function() {
        let unit = await ethers.getContract(CONTRACTS.Unit)
        let governor = await ethers.getContract(CONTRACTS.Governor)
        const encodedFunction = unit.interface.encodeFunctionData("changeState", ["new state"])
        const descriptionHash = ethers.utils.id("some description")
        let funcCallPromise = governor.execute([unit.address], [0], [encodedFunction], descriptionHash)
        await expect(funcCallPromise).to.be.revertedWith("Governor: unknown proposal id")
    })
})