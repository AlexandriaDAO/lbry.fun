use candid::{CandidType, Deserialize, Principal};

#[derive(Debug, CandidType, Deserialize)]
pub enum BotError {
    PoolNotFound { 
        pool_id: u64 
    },
    PoolNotLive { 
        pool_id: u64, 
        launch_time: u64,
        current_time: u64 
    },
    PoolCreationFailed {
        pool_id: u64
    },
    InsufficientBalance { 
        required: u64, 
        available: u64 
    },
    SwapFailed { 
        details: String 
    },
    BurnFailed { 
        details: String 
    },
    CanisterCallFailed { 
        canister: String, 
        method: String, 
        error: String 
    },
    InvalidInput {
        parameter: String,
        reason: String
    },
    TokenApprovalFailed {
        token: String,
        error: String
    },
    NoTokensReceived {
        token_type: String,
        operation: String
    },
    DustTooSmall {
        amount: u64,
        minimum: u64
    },
}

impl BotError {
    pub fn to_string(&self) -> String {
        match self {
            BotError::PoolNotFound { pool_id } => {
                format!("Pool {} not found in secondary_fun registry", pool_id)
            },
            BotError::PoolNotLive { pool_id, launch_time, current_time } => {
                let time_until_live = launch_time.saturating_sub(*current_time);
                format!("Pool {} is not live yet. Time until live: {} seconds", pool_id, time_until_live)
            },
            BotError::PoolCreationFailed { pool_id } => {
                format!("Pool {} creation failed and cannot be used", pool_id)
            },
            BotError::InsufficientBalance { required, available } => {
                format!("Insufficient balance. Required: {} e8s, Available: {} e8s", required, available)
            },
            BotError::SwapFailed { details } => {
                format!("Swap operation failed: {}", details)
            },
            BotError::BurnFailed { details } => {
                format!("Burn operation failed: {}", details)
            },
            BotError::CanisterCallFailed { canister, method, error } => {
                format!("Failed to call {}.{}: {}", canister, method, error)
            },
            BotError::InvalidInput { parameter, reason } => {
                format!("Invalid input for {}: {}", parameter, reason)
            },
            BotError::TokenApprovalFailed { token, error } => {
                format!("Failed to approve tokens for {}: {}", token, error)
            },
            BotError::NoTokensReceived { token_type, operation } => {
                format!("No {} tokens received from {}", token_type, operation)
            },
            BotError::DustTooSmall { amount, minimum } => {
                format!("Amount {} e8s is too small to process. Minimum: {} e8s", amount, minimum)
            },
        }
    }
}

impl From<BotError> for String {
    fn from(error: BotError) -> Self {
        error.to_string()
    }
}

// Helper function to convert generic errors to BotError
pub fn canister_call_error(canister: Principal, method: &str, error: String) -> BotError {
    BotError::CanisterCallFailed {
        canister: canister.to_string(),
        method: method.to_string(),
        error,
    }
}