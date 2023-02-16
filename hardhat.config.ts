import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-waffle"
import { HardhatUserConfig } from "hardhat/config";
import "solidity-coverage"

import { ZERO_ENV } from "./config/consts.json"
import {parseEnv} from "./config/helpers"

function getGoerliEnvVar(envKey: string, specification: string): string {
    const testnet = parseEnv('TESTNET')
    if (!testnet['ok'] || testnet['val'] != 'true') {
        return ZERO_ENV;
    }
    const account = parseEnv(envKey);
    if (!account['ok']) {
        throw Error(`Specify ${specification} for Goerli testnet via setting ${envKey} env variable`);
    }
    return account['val'];
}

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            allowUnlimitedContractSize: true,
        },
        localhost: {
            chainId: 31337,
            allowUnlimitedContractSize: true,
        },
        goerli: {
            url: `https://eth-goerli.alchemyapi.io/v2/${getGoerliEnvVar('ALCHEMY_API_KEY', 'api key')}`,
            accounts: [getGoerliEnvVar('GOERLI_PRIVATE_KEY', 'private key')],
        }
    },
    solidity: {
        version: "0.8.8",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        }
    },
    namedAccounts: {
        deployer: {
            default: 0,
        }
    }
};

export default config;