import {ZERO_ENV} from './consts.json'

export function parseEnv(key: string) {
    const value = process.env[key];
    if (value == undefined) {
        return {
            "val": "",
            "ok": false,
        }
    }
    return {
        "val": value,
        "ok": true,
    }
}

interface TestNet {
    api_key: string;
    private_key: string;
}

export function getTestnet(testnet: string) : TestNet {
    let result = {
        api_key: parseEnv('ALCHEMY_API_KEY')['val'],
        private_key: ZERO_ENV
    }
    let private_var = parseEnv(`${testnet.toUpperCase()}_PRIVATE_KEY`);
    if (private_var['ok']) {
        result.private_key = private_var['val']
    }
    return result
}
