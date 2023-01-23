import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
// @ts-ignore
import { ethers } from "hardhat"
import { ZERO_ADDRESS, CONTRACTS } from "../config/consts.json"

const setupContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { getNamedAccounts, deployments } = hre
    const { log } = deployments
    const { deployer } = await getNamedAccounts()
    const timeLock = await ethers.getContract(CONTRACTS.TimeLock, deployer)
    const governor = await ethers.getContract(CONTRACTS.Governor, deployer)
    const token = await ethers.getContract(CONTRACTS.GovernanceToken, deployer)
    const addresses = await ethers.getSigners();

    log("Setting up contracts for roles...")
    const proposerRole = await timeLock.PROPOSER_ROLE()
    const executorRole = await timeLock.EXECUTOR_ROLE()
    const adminRole = await timeLock.TIMELOCK_ADMIN_ROLE()
    const proposerTx = await timeLock.grantRole(proposerRole, governor.address)
    await proposerTx.wait(1)
    const executorTx = await timeLock.grantRole(executorRole, ZERO_ADDRESS)
    await executorTx.wait(1)
    const revokeTx = await timeLock.revokeRole(adminRole, deployer)
    await revokeTx.wait(1)
    log("Successfuly set up contracts\n")

    // distribution tokens among addresses:
    for (let i = 1; i < addresses.length; ++i) {
        await token.connect(addresses[i]).delegate(addresses[i].address)
    }
    let supply = await token.totalSupply()
    for (let i = 1; i < addresses.length; ++i) {
        await token.transfer(addresses[i].address, supply.div(addresses.length))
    }
}

export default setupContracts;
setupContracts.tags = ["all", "setup"]