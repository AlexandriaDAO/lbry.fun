use candid::{ CandidType, Decode, Encode, Principal};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Bound,
    DefaultMemoryImpl, StableBTreeMap, Storable,
};
use serde::Deserialize;
use std::{borrow::Cow, cell::RefCell};

type Memory = VirtualMemory<DefaultMemoryImpl>;
pub const TOKEN_RECORD_MEM_ID: MemoryId = MemoryId::new(0);

thread_local! {
    // Initialize memory manager
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

  pub static TOKENS: RefCell<StableBTreeMap<u64, TokenRecord, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(TOKEN_RECORD_MEM_ID)) // Bind to VirtualMemory
        )
    );
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TokenStatus {
    Deploying { progress: u8 }, // 0-100
    Live { pool_id: String },
    Failed { reason: String },
}

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
}

impl Storable for TokenStatus {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for TokenRecord {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Unbounded;
}
