import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

import { LIBRARIES } from "../config/consts.json"
import {networkConfig} from "../config/network"

const deployLib: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // @ts-ignore
    const { getNamedAccounts, deployments, network } = hre
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    log(`Deploying ${LIBRARIES.SignatureHandle} and waiting for confirmations...`)
    const lib1 = await deploy(LIBRARIES.SignatureHandle, {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: networkConfig[network.name].blockConfirmations,
    })
    log(`Successfuly deployed ${LIBRARIES.SignatureHandle} at ${lib1.address}\n`)

    log(`Deploying ${LIBRARIES.Commission} and waiting for confirmations...`)
    const lib2 = await deploy(LIBRARIES.Commission, {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: networkConfig[network.name].blockConfirmations,
    })
    log(`Successfuly deployed ${LIBRARIES.Commission} at ${lib2.address}\n`)
}

export default deployLib;
deployLib.tags = ["all", "libraries"]