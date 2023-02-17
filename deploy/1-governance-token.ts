import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
// @ts-ignore
import { ethers } from "hardhat"
import { BigNumber } from "ethers"
import {CONTRACTS, MAX_SUPPLY} from '../config/consts.json'
import {networkConfig} from "../config/network"

const deployGovernanceToken: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const {deployments, getNamedAccounts, network} = hre;
    const {log, deploy} = deployments;
    const { deployer } = await getNamedAccounts();
    log("Deploying token....")
    const governanceToken = await deploy(CONTRACTS.GovernanceToken, {
        from: deployer,
        args: [BigNumber.from(MAX_SUPPLY)],
        log: true,
        waitConfirmations: networkConfig[network.name].blockConfirmations
    })
    log(`Successfuly deployed token at ${governanceToken.address}`);
    log(`Delegating to ${deployer}....`)
    await delegate(governanceToken.address, deployer)
    log("Delegated!\n")
};

const delegate = async (governanceTokenAddress: string, delegatedAccount: string) => {
    const governanceToken = await ethers.getContractAt(CONTRACTS.GovernanceToken, governanceTokenAddress)
    const transactionResponse = await governanceToken.delegate(delegatedAccount)
    await transactionResponse.wait(1)
    console.log(`Checkpoints: ${await governanceToken.numCheckpoints(delegatedAccount)}`)
}

export default deployGovernanceToken;
deployGovernanceToken.tags = ["all", "governanceToken"]