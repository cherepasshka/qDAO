
//@ts-ignore
import { ethers } from "hardhat"

export const getCommission = async() => {
    const commissionProviders = await ethers.getSigners();
    const decisionSource = commissionProviders[0].address
    const requiredSignatures = 3;
    const commissionMembers: string[] = commissionProviders.map(x => x.address)
    
    return {
        members: commissionMembers,
        decisionSource: decisionSource,
        requiredSignatures: requiredSignatures
    }
}