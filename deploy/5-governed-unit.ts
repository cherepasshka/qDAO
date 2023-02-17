import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
// @ts-ignore
import { ethers } from "hardhat"
import {CONTRACTS} from '../config/consts.json'
import {networkConfig} from "../config/network"

const deployUnit: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { getNamedAccounts, deployments, network } = hre
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    log(`Deploying ${CONTRACTS.Unit} and waiting for confirmations...`)
    const unit = await deploy(CONTRACTS.Unit, {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: networkConfig[network.name].blockConfirmations
    })
    log(`Successfuly deployed ${CONTRACTS.Unit} at ${unit.address}\n`)
    
    const unitContract = await ethers.getContractAt(CONTRACTS.Unit, unit.address)
    const timeLock = await ethers.getContract(CONTRACTS.TimeLock)
    const transferTx = await unitContract.transferOwnership(timeLock.address)
    await transferTx.wait(1)
}

export default deployUnit;
deployUnit.tags = ["all", "unit"]