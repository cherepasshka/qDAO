export enum ProposalState {
    Pending = 0,
    Active = 1,
    Canceled = 2,
    Defeated = 3,
    Succeeded = 4,
    Queued = 5,
    Expired = 6,
    Executed = 7
}

export enum VoteType {
    Against = 0,
    For = 1,
    Abstain = 2
}

export enum CommissionState {
    Pending = 0,
    Approved = 1,
    Declined = 2
}