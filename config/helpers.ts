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
    return {
        api_key: parseEnv('ALCHEMY_API_KEY')['val'],
        private_key: parseEnv(`${testnet.toUpperCase()}_PRIVATE_KEY`)['val']
    }
}