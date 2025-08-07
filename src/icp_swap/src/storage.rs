use candid::{ CandidType, Principal };
use candid::{ Decode, Deserialize, Encode };
use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{ memory_manager::{ MemoryId, MemoryManager }, StableBTreeMap };
use ic_stable_structures::{ DefaultMemoryImpl, Storable };
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::{ BTreeSet, HashMap };

use crate::utils::DEFAULT_SECONDARY_RATIO;
use crate::ExecutionError;

// Threshold for acceptable discrepancy (1 transfer fee)
pub const ALLOWED_DISCREPANCY_E8S: u64 = 10_000;

type Memory = VirtualMemory<DefaultMemoryImpl>;
// Memory identifiers for each variable
pub const TOTAL_UNCLAIMED_ICP_REWARD_MEM_ID: MemoryId = MemoryId::new(0);
pub const SECONDARY_RATIO_MEM_ID: MemoryId = MemoryId::new(1);
pub const TOTAL_ARCHIVED_BALANCE_MEM_ID: MemoryId = MemoryId::new(2);
pub const APY_MEM_ID: MemoryId = MemoryId::new(3);
pub const STAKES_MEM_ID: MemoryId = MemoryId::new(4);
pub const ARCHIVED_TRXS_MEM_ID: MemoryId = MemoryId::new(5);
pub const ARCHIVED_TRANSACTION_LOG_MEM_ID: MemoryId = MemoryId::new(6);
pub const DISTRIBUTION_INTERVALS_MEM_ID: MemoryId = MemoryId::new(7);
pub const LOGS_MEM_ID: MemoryId = MemoryId::new(8);
pub const LOGS_COUNTER_ID: MemoryId = MemoryId::new(9);
pub const CONFIGS_MEM_ID: MemoryId = MemoryId::new(10);
pub const LAUNCH_TIME_MEM_ID: MemoryId = MemoryId::new(11);
pub const UNCOLLECTED_ALEX_FEES_MEM_ID: MemoryId = MemoryId::new(12);
// Memory ID 13 is intentionally unused (previously UNCOLLECTED_LP_FEES)
pub const REWARD_POOL_MEM_ID: MemoryId = MemoryId::new(14);
pub const TOKEN_ID_MEM_ID: MemoryId = MemoryId::new(15);

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );
    pub static STATE: RefCell<State> = RefCell::new(State { pending_requests: BTreeSet::new() });
    
    // Store the token ID for status checking
    pub static TOKEN_ID: RefCell<u64> = RefCell::new(0);
    
    // Cache for token status with timestamp
    pub static CACHED_STATUS: RefCell<Option<(TokenStatus, u64)>> = RefCell::new(None);

    pub static APY: RefCell<StableBTreeMap<u32, DailyValues, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(APY_MEM_ID)))
    );
    pub static STAKES: RefCell<StableBTreeMap<Principal, Stake, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(STAKES_MEM_ID)))
    );
    pub static ARCHIVED_TRANSACTION_LOG: RefCell<
        StableBTreeMap<Principal, ArchiveBalance, Memory>
    > = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(ARCHIVED_TRANSACTION_LOG_MEM_ID))
        )
    );

    pub static TOTAL_UNCLAIMED_ICP_REWARD: RefCell<StableBTreeMap<(), u128, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(TOTAL_UNCLAIMED_ICP_REWARD_MEM_ID))
        )
    );
    pub static SECONDARY_RATIO: RefCell<StableBTreeMap<(), SecondaryRatio, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(SECONDARY_RATIO_MEM_ID)))
    );
    pub static TOTAL_ARCHIVED_BALANCE: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(TOTAL_ARCHIVED_BALANCE_MEM_ID)))
    );
    pub static DISTRIBUTION_INTERVALS: RefCell<StableBTreeMap<(), u32, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(DISTRIBUTION_INTERVALS_MEM_ID)))
    );
    pub static LOGS: RefCell<StableBTreeMap<u64, Log, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(LOGS_MEM_ID)))
    );
    pub static LOG_COUNTER: RefCell<u64> = RefCell::new(0);
    pub static PRIMARY_FEE: RefCell<u64> = RefCell::new(0);
    pub static CONFIGS: RefCell<StableBTreeMap<(), Configs, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(CONFIGS_MEM_ID)))
    );
    pub static LAUNCH_TIME: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(LAUNCH_TIME_MEM_ID)))
    );
    
    // Uncollected fees for ALEX stakers (1% of distributions) - survives upgrades
    pub static UNCOLLECTED_ALEX_FEES: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_ALEX_FEES_MEM_ID)))
    );
    
    // The 99% portion is now distributed directly to stakers
    
    // Segregated reward pool - funded by all swap operations
    pub static REWARD_POOL: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(REWARD_POOL_MEM_ID)))
    );
}

pub fn get_total_unclaimed_icp_reward_mem() -> StableBTreeMap<(), u128, Memory> {
    TOTAL_UNCLAIMED_ICP_REWARD.with(|_reward_map| {
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(TOTAL_UNCLAIMED_ICP_REWARD_MEM_ID))
        )
    })
}

pub fn get_secondary_ratio_mem() -> StableBTreeMap<(), SecondaryRatio, Memory> {
    SECONDARY_RATIO.with(|_ratio_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(SECONDARY_RATIO_MEM_ID)))
    })
}
pub fn get_total_archived_balance_mem() -> StableBTreeMap<(), u64, Memory> {
    TOTAL_ARCHIVED_BALANCE.with(|_balance_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(TOTAL_ARCHIVED_BALANCE_MEM_ID)))
    })
}

pub fn get_distribution_interval_mem() -> StableBTreeMap<(), u32, Memory> {
    DISTRIBUTION_INTERVALS.with(|_interval_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(DISTRIBUTION_INTERVALS_MEM_ID)))
    })
}

pub fn get_configs_mem() -> StableBTreeMap<(), Configs, Memory> {
    CONFIGS.with(|_configs_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(CONFIGS_MEM_ID)))
    })
}

pub fn get_launch_time_mem() -> StableBTreeMap<(), u64, Memory> {
    LAUNCH_TIME.with(|_launch_time_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(LAUNCH_TIME_MEM_ID)))
    })
}

pub fn get_uncollected_alex_fees_mem() -> StableBTreeMap<(), u64, Memory> {
    UNCOLLECTED_ALEX_FEES.with(|_fees_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(UNCOLLECTED_ALEX_FEES_MEM_ID)))
    })
}


pub fn get_reward_pool_mem() -> StableBTreeMap<(), u64, Memory> {
    REWARD_POOL.with(|_pool_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(REWARD_POOL_MEM_ID)))
    })
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Stake {
    pub amount: u64,
    pub time: u64,
    pub reward_icp: u128,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct SecondaryRatio {
    pub ratio: u64,
    pub time: u64,
}
impl Default for SecondaryRatio {
    fn default() -> Self {
        SecondaryRatio {
            ratio: DEFAULT_SECONDARY_RATIO, // Default value
            time: ic_cdk::api::time(), // Current timestamp
        }
    }
}

#[derive(CandidType, Deserialize, Clone, Default)]
pub struct Trxs {
    pub archive_trx: HashMap<Principal, ArchiveBalance>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ArchiveBalance {
    pub icp: u64,
}

#[derive(CandidType, Deserialize, Clone, Default)]
pub struct DailyValues {
    pub values: HashMap<u32, u128>,
}

pub struct State {
    pub pending_requests: BTreeSet<Principal>,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Log {
    pub log_id:u64,
    pub timestamp: u64,
    pub caller: Principal,
    pub function: String,
    pub log_type: LogType,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum LogType {
    Info {
        detail: String,
    },
    Error {
        error: ExecutionError,
    },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Configs {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub tokenomics_canister_id: Principal,
    pub icp_ledger_id: Principal,
}

// Simplified TokenStatus matching lbry_fun
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TokenStatus {
    Deploying { progress: u8 },
    Live { pool_id: String },
    Failed { reason: String },
}

#[derive(CandidType, Deserialize)]
pub struct ReconciliationStatus {
    // Core balance tracking
    pub icp_balance_actual: u64,
    pub icp_balance_expected: u64,
    pub discrepancy_e8s: i64,  // No floating-point percentages
    
    // Component breakdown
    pub reward_pool: u64,
    pub uncollected_alex_fees: u64,
    pub total_staked: u64,
    pub operational_balance: u64,
    
    // Audit metadata
    pub timestamp: u64,
    pub canister_id: Principal,
    pub requires_attention: bool,
    pub operational_balance_suspicious: bool,
}

impl Storable for Stake {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for ArchiveBalance {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
impl Storable for SecondaryRatio {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
impl Storable for DailyValues {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for Log {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for Configs {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}