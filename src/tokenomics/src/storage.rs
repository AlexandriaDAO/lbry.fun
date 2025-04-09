use candid::{CandidType, Decode, Encode, Principal};
use ic_stable_structures::storable::Bound;
use ic_stable_structures::StableCell;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    StableBTreeMap,
};
use ic_stable_structures::{DefaultMemoryImpl, Storable};
use serde::Deserialize;
use std::borrow::Cow;
use std::cell::RefCell;

use crate::ExecutionError;
type Memory = VirtualMemory<DefaultMemoryImpl>;

pub const TOTAL_SECONDARY_BURNED_MEM_ID: MemoryId = MemoryId::new(0);
pub const CURRENT_THRESHOLD_MEM_ID: MemoryId = MemoryId::new(1);
pub const TOKEN_LOGS_MEM_ID: MemoryId = MemoryId::new(2);
pub const LOGS_COUNTER_ID: MemoryId = MemoryId::new(3);
pub const CONFIGS_MEM_ID: MemoryId = MemoryId::new(4);
pub const TOKENOMICS_MEM_ID: MemoryId = MemoryId::new(5);

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

    pub static CONFIGS: RefCell<StableCell<Configs,Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(CONFIGS_MEM_ID)),
            Configs {primary_token_id:Principal::anonymous(),
                secondary_token_id:Principal::anonymous(),
                swap_canister_id:Principal::anonymous(),
                frontend_canister_id:Principal::anonymous(),
                max_primary_supply:0,
                 initial_primary_mint: 0,
                 initial_secondary_burn: 0,max_primary_phase:0,
            }
        ).unwrap()
    );
    pub static TOKENOMICS:RefCell<StableCell<TokenomicsSchedule,Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(TOKENOMICS_MEM_ID)),
            TokenomicsSchedule::default()

        ).unwrap()
    );



}

pub fn get_total_secondary_burned_mem() -> StableBTreeMap<(), u64, Memory> {
    TOTAL_SECONDARY_BURNED.with(|burned_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(TOTAL_SECONDARY_BURNED_MEM_ID)))
    })
}

pub fn get_current_threshold_index_mem() -> StableBTreeMap<(), u32, Memory> {
    CURRENT_THRESHOLD_INDEX.with(|threshold_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(CURRENT_THRESHOLD_MEM_ID)))
    })
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Logs {
    pub log: String,
    pub time: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TokenLogs {
    pub log_id: u64,
    pub timestamp: u64,
    pub caller: Principal,
    pub function: String,
    pub log_type: TokenLogType,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TokenLogType {
    Info { detail: String },
    Error { error: ExecutionError },
}

#[derive(CandidType, Deserialize, Clone, Debug, Default)]
pub struct TokenomicsSchedule {
    pub secondary_burn_thresholds: Vec<u64>,
    pub primary_mint_per_threshold: Vec<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Configs {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub swap_canister_id: Principal,
    pub frontend_canister_id: Principal,
    pub max_primary_supply: u64,
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub max_primary_phase:u64
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
impl Storable for Configs {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for TokenomicsSchedule {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
