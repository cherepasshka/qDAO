import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
// @ts-ignore
import { ethers } from "hardhat"
import {CONTRACTS} from '../config/consts.json'

const deployGovernanceToken: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const {deployments, getNamedAccounts} = hre;
    const {log, deploy} = deployments;
    const { deployer } = await getNamedAccounts();
    log("Deploying token....")
    const governanceToken = await deploy(CONTRACTS.GovernanceToken, {
        from: deployer,
        args: [],
        log: true,
    })
    log(`Successfuly deployed token at ${governanceToken.address}`);
    log(`Delegating to ${deployer}....`)
    await delegate(governanceToken.address, deployer)
    log("Delegated!\n")
};

const delegate = async (governanceTokenAddress: string, delegatedAccount: string) => {
    const governanceToken = await ethers.getContractAt("GovernanceToken", governanceTokenAddress)
    const transactionResponse = await governanceToken.delegate(delegatedAccount)
    await transactionResponse.wait(1)
    console.log(`Checkpoints: ${await governanceToken.numCheckpoints(delegatedAccount)}`)
}

export default deployGovernanceToken;
deployGovernanceToken.tags = ["all", "governanceToken"]