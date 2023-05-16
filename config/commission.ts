
//@ts-ignore
import { ethers, SignerWithAddress } from "hardhat"

import * as fs from 'fs';
import { parseEnv } from "./helpers";
import { exit } from "process";

export interface CommissionType {
    decisionSource: string,
    requiredSignatures: number,
    members: SignerWithAddress[],
}

export const getCommissionAddresses = function(commission: CommissionType): string[] {
    return commission.members.map(member => member.address)
}

export const getCommission = async(network: string): Promise<CommissionType> => {
    if(network == 'hardhat') {
        const allProviders = await ethers.getSigners();
        const decisionSource = allProviders[0].address
        const requiredSignatures = 3;
        
        return {
            members: allProviders.slice(0, 6),
            decisionSource: decisionSource,
            requiredSignatures: requiredSignatures
        }
    }
    const commissionFile = parseEnv("COMMISSION");
    if (!commissionFile['ok']) {
        console.log("No file to read commission from, please specify it via $COMMISSION")
        exit(1)
    }
    const accountsData = fs.readFileSync(commissionFile["val"], 'utf-8');
    const accounts = JSON.parse(accountsData).accounts;
    return {
        members: accounts,
        decisionSource: accounts[0].address,
        requiredSignatures: accounts.length,
    }
}