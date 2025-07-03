use candid::{CandidType, Decode, Encode, Principal};
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{DefaultMemoryImpl, Storable};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    StableBTreeMap,
};
use serde::Deserialize;
use std::borrow::Cow;
use std::cell::RefCell;

use crate::ExecutionError;
type Memory = VirtualMemory<DefaultMemoryImpl>;

// Original audited values for historical reference:
// These were the hardcoded values used before dynamic configuration was implemented.
// All new tokens (since January 2025) use dynamic arrays passed during initialization.
//
// SECONDARY_THRESHOLDS (natural units):
// [21_000, 42_000, 84_000, 168_000, 336_000, 672_000, 1_344_000, 2_688_000,
//  5_376_000, 10_752_000, 21_504_000, 43_008_000, 86_016_000, 172_032_000,
//  344_064_000, 688_128_000, 1_376_256_000, 61_632_592_000]
//
// PRIMARY_PER_THRESHOLD (4-decimal format, e.g., 50_000 = 5.0 tokens):
// [50_000, 25_000, 12_500, 6_250, 3_125, 1_562, 781, 391, 195, 98, 49, 24,
//  12, 6, 3, 2, 1, 1]

pub const TOTAL_SECONDARY_BURNED_MEM_ID: MemoryId = MemoryId::new(0);
pub const CURRENT_THRESHOLD_MEM_ID: MemoryId = MemoryId::new(1);
pub const TOKEN_LOGS_MEM_ID: MemoryId = MemoryId::new(2);
pub const LOGS_COUNTER_ID: MemoryId = MemoryId::new(3);
pub const CONFIG_MEM_ID: MemoryId = MemoryId::new(4);
pub const THRESHOLDS_MEM_ID: MemoryId = MemoryId::new(5);  // NEW: Dynamic thresholds storage
pub const REWARDS_MEM_ID: MemoryId = MemoryId::new(6);     // NEW: Dynamic rewards storage

// Configuration struct for minimal configurability
#[derive(CandidType, Deserialize, Clone)]
pub struct Config {
    pub primary_token_ledger: Principal,
    pub secondary_token_ledger: Principal,
    pub icp_swap_canister_id: Principal,  // Added to fix authorization
    pub max_primary_supply: u64,  // Added to use actual max supply instead of hardcoded
}

impl Storable for Config {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

thread_local! {
    //Tokenomics
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    pub static TOTAL_SECONDARY_BURNED: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(TOTAL_SECONDARY_BURNED_MEM_ID)))
    );
    pub static CURRENT_THRESHOLD_INDEX: RefCell<StableBTreeMap<(), u32, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(CURRENT_THRESHOLD_MEM_ID)))
    );
    pub static LOGS: RefCell<Vec<Logs>> = RefCell::new(Vec::new());

    pub static TOKEN_LOGS: RefCell<StableBTreeMap<u64, TokenLogs, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(TOKEN_LOGS_MEM_ID)))
    );
    pub static TOKEN_LOG_COUNTER: RefCell<u64> = RefCell::new(0);

    pub static CONFIG: RefCell<StableBTreeMap<(), Config, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(CONFIG_MEM_ID)))
    );
    
    // NEW: Dynamic arrays for configurable tokenomics
    pub static DYNAMIC_THRESHOLDS: RefCell<Vec<u64>> = RefCell::new(Vec::new());
    pub static DYNAMIC_REWARDS: RefCell<Vec<u64>> = RefCell::new(Vec::new());
}

pub fn get_total_secondary_burned_mem() -> StableBTreeMap<(), u64, Memory> {
    TOTAL_SECONDARY_BURNED.with(|_burned_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(TOTAL_SECONDARY_BURNED_MEM_ID)))
    })
}

pub fn get_current_threshold_index_mem() -> StableBTreeMap<(), u32, Memory> {
    CURRENT_THRESHOLD_INDEX.with(|_threshold_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(CURRENT_THRESHOLD_MEM_ID)))
    })
}

pub fn get_config_mem() -> StableBTreeMap<(), Config, Memory> {
    CONFIG.with(|_config| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(CONFIG_MEM_ID)))
    })
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Logs{
    pub log:String,
    pub time:u64
}


#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TokenLogs {
    pub log_id:u64,
    pub timestamp: u64,
    pub caller: Principal,
    pub function: String,
    pub log_type: TokenLogType,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TokenLogType {
    Info {
        detail: String,
    },
    Error {
        error: ExecutionError,
    },
}

impl Storable for TokenLogs {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// Helper functions for dynamic arrays
pub fn get_thresholds() -> Result<Vec<u64>, String> {
    DYNAMIC_THRESHOLDS.with(|t| {
        let thresholds = t.borrow();
        if thresholds.is_empty() {
            Err("Tokenomics thresholds not initialized. Canister not properly configured.".to_string())
        } else {
            Ok(thresholds.clone())
        }
    })
}

pub fn get_rewards() -> Result<Vec<u64>, String> {
    DYNAMIC_REWARDS.with(|r| {
        let rewards = r.borrow();
        if rewards.is_empty() {
            Err("Tokenomics rewards not initialized. Canister not properly configured.".to_string())
        } else {
            Ok(rewards.clone())
        }
    })
}

pub fn set_thresholds(thresholds: Vec<u64>) {
    DYNAMIC_THRESHOLDS.with(|t| *t.borrow_mut() = thresholds);
}

pub fn set_rewards(rewards: Vec<u64>) {
    DYNAMIC_REWARDS.with(|r| *r.borrow_mut() = rewards);
}