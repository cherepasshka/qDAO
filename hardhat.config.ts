import "hardhat-deploy"
import "@nomiclabs/hardhat-ethers"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-waffle"
import { HardhatUserConfig } from "hardhat/config";
import "solidity-coverage"
import {getTestnet} from "./config/helpers"

const testnets = {
    'goerli': getTestnet('goerli'),
    'sepolia': getTestnet('sepolia')
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
            url: `https://eth-goerli.alchemyapi.io/v2/${testnets['goerli'].api_key}`,
            accounts: [testnets['goerli'].private_key],
        },
        sepolia: {
            url: `https://eth-sepolia.g.alchemy.com/v2/${testnets['sepolia'].api_key}`,
            accounts: [testnets['sepolia'].private_key]
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