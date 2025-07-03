use crate::types::{LoopSnapshot, TokenInfo};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl,
};
use std::{cell::RefCell, collections::HashMap};

type Memory = VirtualMemory<DefaultMemoryImpl>;

const SNAPSHOTS_MEM_ID: MemoryId = MemoryId::new(0);
const TOKEN_INFO_MEM_ID: MemoryId = MemoryId::new(1);

thread_local! {
    // Memory manager
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    // Pool ID -> Vec<LoopSnapshot> - Using in-memory HashMap for simplicity
    // In production, might want to use StableBTreeMap for persistence
    pub static POOL_SNAPSHOTS: RefCell<HashMap<u64, Vec<LoopSnapshot>>> = RefCell::new(HashMap::new());
    
    // Pool ID -> TokenInfo cache
    pub static TOKEN_INFO_CACHE: RefCell<HashMap<u64, TokenInfo>> = RefCell::new(HashMap::new());
    
    // Track cumulative values across pools
    pub static CUMULATIVE_STATE: RefCell<HashMap<u64, CumulativeState>> = RefCell::new(HashMap::new());
}

#[derive(Clone, Default)]
pub struct CumulativeState {
    pub total_icp_spent: u64,
    pub total_secondary_burned: u64,
    pub total_primary_minted: u64,
    pub total_dust: u64,
}

// Storage operations
pub fn add_snapshot(pool_id: u64, snapshot: LoopSnapshot) {
    POOL_SNAPSHOTS.with(|snapshots| {
        let mut snapshots = snapshots.borrow_mut();
        snapshots.entry(pool_id).or_insert_with(Vec::new).push(snapshot);
    });
}

pub fn get_snapshots(pool_id: u64) -> Vec<LoopSnapshot> {
    POOL_SNAPSHOTS.with(|snapshots| {
        snapshots.borrow().get(&pool_id).cloned().unwrap_or_default()
    })
}

pub fn cache_token_info(pool_id: u64, token_info: TokenInfo) {
    TOKEN_INFO_CACHE.with(|cache| {
        cache.borrow_mut().insert(pool_id, token_info);
    });
}

pub fn get_cached_token_info(pool_id: u64) -> Option<TokenInfo> {
    TOKEN_INFO_CACHE.with(|cache| {
        cache.borrow().get(&pool_id).cloned()
    })
}

pub fn update_cumulative_state(pool_id: u64, icp_spent: u64, secondary_burned: u64, primary_minted: u64, dust: u64) {
    CUMULATIVE_STATE.with(|state| {
        let mut state = state.borrow_mut();
        let cumulative = state.entry(pool_id).or_insert_with(CumulativeState::default);
        cumulative.total_icp_spent += icp_spent;
        cumulative.total_secondary_burned += secondary_burned;
        cumulative.total_primary_minted += primary_minted;
        cumulative.total_dust += dust;
    });
}

pub fn get_cumulative_state(pool_id: u64) -> CumulativeState {
    CUMULATIVE_STATE.with(|state| {
        state.borrow().get(&pool_id).cloned().unwrap_or_default()
    })
}

pub fn clear_pool_data(pool_id: u64) {
    POOL_SNAPSHOTS.with(|snapshots| {
        snapshots.borrow_mut().remove(&pool_id);
    });
    CUMULATIVE_STATE.with(|state| {
        state.borrow_mut().remove(&pool_id);
    });
}