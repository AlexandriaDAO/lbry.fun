export const getErrorMessage = (error) => {
    console.log("Error received:", error);
    const getMessage = (reason, operation, details) => {
        return reason || operation || details || "Unknown error occurred.";
    };
    if ("MinimumRequired" in error) {
        return { title: "Minimum Required Amount", message: getMessage(undefined, undefined, error.MinimumRequired.details) };
    }
    if ("InvalidAmount" in error) {
        return { title: "Invalid Amount", message: getMessage(error.InvalidAmount.reason, undefined, error.InvalidAmount.details) };
    }
    if ("InsufficientBalance" in error) {
        return { title: "Insufficient Balance", message: getMessage(undefined, undefined, error.InsufficientBalance.details) };
    }
    if ("InsufficientCanisterBalance" in error) {
        return { title: "Insufficient Canister Balance", message: getMessage(undefined, undefined, error.InsufficientCanisterBalance.details) };
    }
    if ("InsufficientBalanceRewardDistribution" in error) {
        return { title: "Insufficient Balance for Reward Distribution", message: getMessage(undefined, undefined, error.InsufficientBalanceRewardDistribution.details) };
    }
    if ("TransferFailed" in error) {
        return { title: "Transfer Failed", message: getMessage(error.TransferFailed.reason, undefined, error.TransferFailed.details) };
    }
    if ("MintFailed" in error) {
        console.log("ok?", error);
        return { title: "Mint Failed", message: getMessage(error.MintFailed.reason, undefined, error.MintFailed.details) };
    }
    if ("BurnFailed" in error) {
        return { title: "Burn Failed", message: getMessage(error.BurnFailed.reason, undefined, error.BurnFailed.details) };
    }
    if ("MultiplicationOverflow" in error) {
        return { title: "Multiplication Overflow", message: getMessage(undefined, error.MultiplicationOverflow.operation, error.MultiplicationOverflow.details) };
    }
    if ("AdditionOverflow" in error) {
        return { title: "Addition Overflow", message: getMessage(undefined, error.AdditionOverflow.operation, error.AdditionOverflow.details) };
    }
    if ("Underflow" in error) {
        return { title: "Underflow Error", message: getMessage(undefined, error.Underflow.operation, error.Underflow.details) };
    }
    if ("DivisionFailed" in error) {
        return { title: "Division Error", message: getMessage(undefined, error.DivisionFailed.operation, error.DivisionFailed.details) };
    }
    if ("RewardDistributionError" in error) {
        return { title: "Reward Distribution Error", message: getMessage(error.RewardDistributionError.reason) };
    }
    if ("CanisterCallFailed" in error) {
        return { title: "Canister Call Failed", message: getMessage(undefined, undefined, error.CanisterCallFailed.details) };
    }
    if ("RateLookupFailed" in error) {
        return { title: "Rate Lookup Failed", message: getMessage(undefined, undefined, error.RateLookupFailed.details) };
    }
    if ("StateError" in error) {
        return { title: "State Error", message: getMessage(undefined, undefined, error.StateError) };
    }
    if ("Unauthorized" in error) {
        return { title: "Unauthorized Access", message: getMessage(undefined, undefined, error.Unauthorized) };
    }
    return { title: "Unexpected Error", message: "An unexpected error occurred." };
};
