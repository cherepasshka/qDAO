import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { MIN_DELAY, CONTRACTS } from "../config/consts"

const deployTimeLock: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { getNamedAccounts, deployments } = hre
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    log(`Deploying ${CONTRACTS.TimeLock} and waiting for confirmations...`)
    const timeLock = await deploy(CONTRACTS.TimeLock, {
        from: deployer,
        args: [MIN_DELAY, [], [], deployer],
        log: true,
    })
    log(`Successfuly deployed ${CONTRACTS.TimeLock} at ${timeLock.address}\n`)
}

export default deployTimeLock;
deployTimeLock.tags = ["all", "timelock"]