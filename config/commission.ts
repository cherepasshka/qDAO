
//@ts-ignore
import { ethers, SignerWithAddress } from "hardhat"

export interface CommissionType {
    decisionSource: string,
    requiredSignatures: number,
    members: SignerWithAddress[],
}
export const getCommissionAddresses = function(commission: CommissionType): string[] {
    return commission.members.map(member => member.address)
}
export const getCommission = async(): Promise<CommissionType> => {
    const commissionProviders = await ethers.getSigners();
    const decisionSource = commissionProviders[0].address
    const requiredSignatures = 3;
    
    return {
        members: commissionProviders,
        decisionSource: decisionSource,
        requiredSignatures: requiredSignatures
    }
}