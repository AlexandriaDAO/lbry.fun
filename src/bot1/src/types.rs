use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

// Constants
pub const E8S: u64 = 100_000_000;
pub const ICP_USD_RATE: f64 = 10.0; // Placeholder - could query from XRC
pub const EFFECTIVE_SECONDARY_COST: f64 = 0.005; // After 50% ICP return
pub const SECONDARY_TOKEN_FEE: u64 = 10_000; // ICRC-1 transfer fee in E8S

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct LoopSnapshot {
    pub loop_number: u32,
    
    // Transaction amounts (all in E8S)
    pub icp_spent: u64,
    pub secondary_received: u64,
    pub secondary_burned: u64,
    pub primary_received: u64,
    
    // Token supplies from canister queries (in E8S)
    pub secondary_total_supply: u64,
    pub primary_total_supply: u64,
    
    // Cumulative tracking (in E8S)
    pub cumulative_icp_spent: u64,
    pub cumulative_secondary_burned: u64,
    pub cumulative_primary_minted: u64,
    
    // Derived metrics
    pub actual_mint_rate: f64,  // primary_received / secondary_burned
    pub cost_per_primary: f64,  // (icp_spent * 0.005) / primary_received
    
    // Dust tracking (in E8S)
    pub secondary_dust: u64,  // Leftover secondary that couldn't be burned
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct ValidationTable {
    pub pool_id: u64,
    pub token_info: TokenInfo,
    pub pool_parameters: PoolParameters,
    pub snapshots: Vec<LoopSnapshot>,
    
    // Graph-ready data (matching frontend format)
    pub cumulative_supply_data: GraphData,
    pub minted_per_epoch_data: EpochData,
    pub cost_to_mint_data: CostData,
    pub cumulative_usd_cost_data: GraphData,
    pub cumulative_percentage_supply_data: PercentageGraphData,
    
    // Summary metrics
    pub summary_data: SummaryData,
    pub total_loops: u32,
    pub total_icp_spent: u64,
    pub total_usd_cost: f64,
    pub total_secondary_burned: u64,
    pub total_primary_minted: u64,
    pub average_mint_rate: f64,
    pub total_dust_accumulated: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct GraphData {
    pub x_axis: Vec<u64>,  // cumulative secondary burned (in E8S)
    pub y_axis: Vec<u64>,  // cumulative primary minted (in E8S)
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct EpochData {
    pub x_axis: Vec<String>,  // "Loop 1", "Loop 2", etc.
    pub y_axis: Vec<u64>,     // primary minted per loop (in E8S)
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct CostData {
    pub x_axis: Vec<u64>,  // cumulative primary minted
    pub y_axis: Vec<f64>,  // cost per token USD
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct PercentageGraphData {
    pub x_axis: Vec<u64>,  // cumulative primary minted (in E8S)
    pub y_axis: Vec<f64>,  // percentage of max supply
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct SummaryData {
    pub epochs_reached: u32,
    pub total_minting_valuation: f64,  // Total USD cost
    pub initial_mint_cost: f64,        // First primary token cost
    pub final_mint_cost: f64,          // Last primary token cost
    pub actual_total_minted: u64,      // Total primary minted (E8S)
    pub percentage_of_max_supply: f64, // % of max supply reached
    pub average_cost_per_token: f64,   // Total USD / tokens
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct PoolParameters {
    pub primary_max_supply: u64,        // In E8S
    pub initial_secondary_burn: u64,    // In E8S
    pub halving_step: u64,              // Percentage
    pub initial_reward_per_burn_unit: u64, // Primary tokens per secondary
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct TokenInfo {
    pub primary_token_id: String,
    pub secondary_token_id: String,
    pub icp_swap_canister_id: String,
    pub tokenomics_canister_id: String,
}

// Token status enum from lbry_fun
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TokenStatus {
    Pending,
    Live { pool_id: String },
    Failed { reason: String },
}

// Mirror of TokenRecord from lbry_fun for decoding
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TokenRecord {
    pub id: u64,
    pub status: TokenStatus,
    // Core token info
    pub primary_token_id: Principal,
    pub primary_token_name: String,
    pub primary_token_symbol: String,
    pub primary_token_max_supply: u64,
    pub secondary_token_id: Principal,
    pub secondary_token_name: String,
    pub secondary_token_symbol: String,
    // Canister references
    pub tokenomics_canister_id: Principal,
    pub icp_swap_canister_id: Principal,
    pub logs_canister_id: Principal,
    // Configuration
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub halving_step: u64,
    pub threshold_multiplier: f64,
    pub initial_reward_per_burn_unit: u64,
    pub distribution_interval_seconds: u64,
    pub launch_delay_seconds: u64,
    // Metadata
    pub caller: Principal,
    pub created_time: u64,
    pub launched_at: u64, // When token goes live (created_time + launch_delay)
    pub codebase_version: String,
}

// ICRC1 types
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}


// Error types
#[derive(CandidType, Deserialize, Debug)]
pub enum BotError {
    PoolNotFound(u64),
    InsufficientICP { required: u64, available: u64 },
    SwapFailed(String),
    BurnFailed(String),
    TokenQueryFailed(String),
    InvalidPoolState(String),
}

// ExecutionError from icp_swap canister - simplified version for decoding
#[derive(CandidType, Deserialize, Debug)]
pub enum ExecutionError {
    MinimumRequired {
        required: u64,
        provided: u64,
        token: String,
        details: String,
    },
    InvalidAmount {
        reason: String,
        amount: u64,
        details: String,
    },
    InsufficientBalance {
        required: u64,
        available: u64,
        token: String,
        details: String,
    },
    InsufficientCanisterBalance {
        required: u64,
        available: u64,
        details: String,
    },
    InsufficientBalanceRewardDistribution {
        available: u128,
        details: String,
    },
    TransferFailed {
        source: String,
        dest: String,
        token: String,
        amount: u64,
        details: String,
        reason: String,
    },
    MintFailed {
        token: String,
        amount: u64,
        reason: String,
        details: String,
    },
    BurnFailed {
        token: String,
        amount: u64,
        reason: String,
        details: String,
    },
    AdditionOverflow {
        operation: String,
        details: String,
    },
    MultiplicationOverflow {
        operation: String,
        details: String,
    },
    Underflow {
        operation: String,
        details: String,
    },
    DivisionFailed {
        operation: String,
        details: String,
    },
    RewardDistributionError {
        reason: String,
    },
    CanisterCallFailed {
        canister: String,
        method: String,
        details: String,
    },
    RateLookupFailed {
        details: String,
    },
    StateError(String),
    Unauthorized(String),
    ConversionError {
        details: String,
    },
}

// Tokenomics ExecutionError type
#[derive(CandidType, Deserialize, Debug)]
pub enum TokenomicsExecutionError {
    Underflow { operation: String, details: String },
    DivisionFailed { operation: String, details: String },
    MultiplicationOverflow { operation: String, details: String },
    AdditionOverflow { operation: String, details: String },
    CanisterCallFailed {
        method: String,
        canister: String,
        details: String,
    },
    NoMorePrimaryCanBeMinted { reason: String },
    MaxMintPrimaryReached { reason: String },
    MintFailed {
        token: String,
        details: String,
        amount: u64,
        reason: String,
    },
    MaxPrimaryPerTrnxReached { reason: String },
}

// Log types from tokenomics canister
#[derive(CandidType, Deserialize, Debug)]
pub enum TokenLogType {
    Error { error: TokenomicsExecutionError },
    Info { detail: String },
}

#[derive(CandidType, Deserialize, Debug)]
pub struct TokenLogs {
    pub function: String,
    pub log_type: TokenLogType,
    pub log_id: u64,
    pub timestamp: u64,
    pub caller: Principal,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct PaginatedTokenLogs {
    pub page_size: u64,
    pub logs: Vec<TokenLogs>,
    pub total_pages: u64,
    pub current_page: u64,
}

// Log types from icp_swap canister
#[derive(CandidType, Deserialize, Debug)]
pub enum LogType {
    Error { error: ExecutionError },
    Info { detail: String },
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Log {
    pub function: String,
    pub log_type: LogType,
    pub log_id: u64,
    pub timestamp: u64,
    pub caller: Principal,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct PaginatedLogs {
    pub page_size: u64,
    pub logs: Vec<Log>,
    pub total_pages: u64,
    pub current_page: u64,
}

// Combined logs type
#[derive(CandidType, Deserialize, Debug)]
pub struct PoolLogs {
    pub tokenomics_logs: Option<PaginatedTokenLogs>,
    pub icp_swap_logs: Option<PaginatedLogs>,
}

// Tokenomics schedule from tokenomics canister
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct TokenomicsSchedule {
    pub thresholds: Vec<u64>,
    pub rewards: Vec<u64>,
}

// Summary types for epoch-focused data
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct EpochSnapshot {
    pub epoch_number: u32,
    pub mint_rate: f64,
    pub halving_occurred: bool,
    
    // Epoch aggregates
    pub total_loops_in_epoch: u32,
    pub total_secondary_burned_in_epoch: u64,
    pub total_primary_minted_in_epoch: u64,
    pub total_icp_spent_in_epoch: u64,
    
    // Cost metrics
    pub avg_cost_per_token_in_epoch: f64,
    pub min_cost_in_epoch: f64,
    pub max_cost_in_epoch: f64,
    
    // Cumulative state at epoch end
    pub cumulative_primary_minted: u64,
    pub cumulative_secondary_burned: u64,
    pub cumulative_icp_spent: u64,
    pub percentage_of_max_supply: f64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct ValidationSummary {
    pub pool_id: u64,
    pub token_info: TokenInfo,
    pub pool_parameters: PoolParameters,
    
    // Core metrics
    pub total_loops: u32,
    pub epochs_reached: u32,
    pub final_percentage_minted: f64,
    
    // Epoch data
    pub epoch_snapshots: Vec<EpochSnapshot>,
    
    // Key transition points
    pub first_loop: LoopSnapshot,
    pub last_loop: LoopSnapshot,
    
    // Summary statistics
    pub total_icp_spent: u64,
    pub total_usd_cost: f64,
    pub average_mint_rate: f64,
    pub average_cost_per_token: f64,
    
    // NEW: Enhanced analysis fields
    pub epoch_analysis: Option<EpochCrossingAnalysis>,
    pub rate_verification: Option<RateVerification>,
    pub largest_multi_epoch_burn: Option<MultiEpochBurn>,
    pub analysis_warnings: Vec<String>,
}

// NEW: Analysis data structures for enhanced tracking

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct TheoreticalEpochContribution {
    pub epoch_number: u32,
    pub amount_burned: u64,
    pub rate_4decimal: u64,      // 46280 = 4.628
    pub rate_human: f64,         // 4.628
    pub amount_minted: u64,
    pub percentage_of_burn: f64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct SingleEpochBurn {
    pub loop_number: u32,
    pub epoch: u32,
    pub actual_rate: f64,
    pub expected_rate: f64,
    pub deviation_percent: f64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct MultiEpochBurn {
    pub loop_number: u32,
    pub epochs_crossed: Vec<u32>,
    pub actual_total: u64,
    pub theoretical_total: u64,
    pub theoretical_breakdown: Vec<TheoreticalEpochContribution>,
    pub deviation_percent: f64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct EpochCrossingAnalysis {
    pub single_epoch_burns: Vec<SingleEpochBurn>,
    pub multi_epoch_burns: Vec<MultiEpochBurn>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct RateVerification {
    pub configured_halving: u32,
    pub observed_halvings: Vec<ObservedHalving>,
    pub status: VerificationStatus,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct ObservedHalving {
    pub from_epoch: u32,
    pub to_epoch: u32,
    pub observed_percentage: f64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub enum VerificationStatus {
    Verified,
    InsufficientData,
    Mismatch { expected: f64, observed: f64 },
}