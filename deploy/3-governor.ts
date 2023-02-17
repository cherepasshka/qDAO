import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import {getCommission, getCommissionAddresses} from "../config/commission"
import {
  QUORUM_PERCENTAGE,
  VOTING_PERIOD,
  VOTING_DELAY,
  PROPOSAL_THRESHOLD,
  CONTRACTS,
} from "../config/consts.json"
import {networkConfig} from "../config/network"

const deployGovernorContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { getNamedAccounts, deployments, network } = hre
    const { deploy, log, get } = deployments
    const { deployer } = await getNamedAccounts()
    const governanceToken = await get(CONTRACTS.GovernanceToken)
    const timeLock = await get(CONTRACTS.TimeLock)
    const commission = await getCommission()
    const args = [
        governanceToken.address,
        timeLock.address,
        VOTING_DELAY,
        VOTING_PERIOD,
        PROPOSAL_THRESHOLD,
        QUORUM_PERCENTAGE,
        [getCommissionAddresses(commission), commission.decisionSource, commission.requiredSignatures]
    ]
    
    log(`Deploying ${CONTRACTS.Governor} and waiting for confirmations...`)
    const governorContract = await deploy(CONTRACTS.Governor, {
        from: deployer,
        args: args, 
        log: true,
        waitConfirmations: networkConfig[network.name].blockConfirmations
    })
    log(`Successfuly deployed ${CONTRACTS.Governor} at ${governorContract.address}\n`)
}

export default deployGovernorContract;
deployGovernorContract.tags = ["all", "governor"]