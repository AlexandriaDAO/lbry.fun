use candid::{types::principal, CandidType, Decode, Encode, Principal};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Bound,
    DefaultMemoryImpl, StableBTreeMap, Storable,
};
use serde::{Deserialize, Serialize};
use std::{borrow::Cow, cell::RefCell};

type Memory = VirtualMemory<DefaultMemoryImpl>;
pub const TOKEN_RECORD_MEM_ID: MemoryId = MemoryId::new(0);

thread_local! {
    // Initialize memory manager
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

  pub static TOKENS: RefCell<StableBTreeMap<u64, TokenRecord, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(TOKEN_RECORD_MEM_ID)) // Bind to VirtualMemory
        )
    );
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TokenRecord {
    pub id: u64,

    pub primary_token_id: Principal,
    pub primary_token_name: String,
    pub primary_token_symbol: String,
    pub primary_token_max_supply: u64,

    pub secondary_token_id: Principal,
    pub secondary_token_name: String,
    pub secondary_token_symbol: String,
    pub secondary_token_max_supply: u64,
    pub caller: Principal,
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
