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