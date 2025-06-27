use candid::{CandidType, Principal, Nat};
use candid::{Decode, Deserialize, Encode};
use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{ StableCell};
use ic_stable_structures::StableBTreeMap;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
use ic_stable_structures::{ DefaultMemoryImpl, Storable};
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::{BTreeSet, HashMap};
use ic_cdk_timers::TimerId;

use crate::utils::DEFAULT_SECONDARY_RATIO;
use crate::ExecutionError;

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
pub const LP_TREASURY_MEM_ID: MemoryId = MemoryId::new(11);
pub const TREASURY_STATE_MEM_ID: MemoryId = MemoryId::new(12);
pub const ACCUMULATED_PRIMARY_TOKENS_MEM_ID: MemoryId = MemoryId::new(13);
pub const DISTRIBUTION_INTERVAL_SECONDS_MEM_ID: MemoryId = MemoryId::new(14);
pub const DISTRIBUTION_EVENTS_MEM_ID: MemoryId = MemoryId::new(15);
pub const NEXT_EVENT_ID_MEM_ID: MemoryId = MemoryId::new(16);

// Distribution tracking types
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DistributionEvent {
    pub event_id: u64,
    pub timestamp: u64,
    pub distribution_cycle: u32,
    pub total_available: u64,
    pub allocations: DistributionAllocations,
    pub results: DistributionResults,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DistributionAllocations {
    pub alexandria_allocated: u64,      // Always 1% of distribution
    pub lp_treasury_allocated: u64,     // Always 49.5% of distribution
    pub stakers_allocated: u64,         // Always 49.5% of distribution
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DistributionResults {
    pub alexandria_sent: Option<u64>,           // None if transfer failed
    pub lp_treasury_added: u64,                 // Always succeeds (internal counter)
    pub stakers_distributed: Option<u64>,       // None if no stakers
    pub stakers_rollover: u64,                  // Amount that rolls to next cycle
    pub lp_provision_status: LpProvisionStatus, // Status of async LP provision
    pub error_details: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum LpProvisionStatus {
    Pending,                    // Not yet attempted
    Success { lp_tokens: Nat }, // Successfully added liquidity
    Failed { reason: String },  // Failed to add liquidity
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DistributionSummary {
    pub total_cycles: u32,
    pub total_alexandria_sent: u64,
    pub total_lp_treasury_balance: u64,
    pub total_stakers_distributed: u64,
    pub current_lp_provision_queue: u64,  // Accumulated primary tokens
    pub last_distribution: Option<DistributionEvent>,
    pub lifetime_totals: LifetimeDistributionTotals,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct LifetimeDistributionTotals {
    pub total_distributed: u64,
    pub alexandria_total: u64,
    pub lp_treasury_total: u64,
    pub stakers_total: u64,
}

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );
    pub static STATE: RefCell<State> = RefCell::new(State { pending_requests: BTreeSet::new() });

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

    pub static TOTAL_UNCLAIMED_ICP_REWARD: RefCell<StableBTreeMap<(), u64, Memory>> = RefCell::new(
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

    pub static CONFIGS: RefCell<StableCell<Configs,Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(CONFIGS_MEM_ID)),
            Configs {
                // Default values
                primary_token_id:Principal::anonymous(),
                secondary_token_id: Principal::anonymous(),
                tokenomics_cansiter_id:Principal::anonymous(),
                icp_ledger_id: Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap(),
            }
        ).unwrap()
    );

    pub static LP_TREASURY: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(MEMORY_MANAGER.with(|m| m.borrow().get(LP_TREASURY_MEM_ID)), 0).unwrap()
    );

    pub static TREASURY_STATE: RefCell<StableCell<TreasuryState, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(TREASURY_STATE_MEM_ID)),
            TreasuryState {
                next_earliest_provision_timestamp: 0,
            }
        ).unwrap()
    );
    
    pub static ACCUMULATED_PRIMARY_TOKENS: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(MEMORY_MANAGER.with(|m| m.borrow().get(ACCUMULATED_PRIMARY_TOKENS_MEM_ID)), 0).unwrap()
    );
    
    pub static DISTRIBUTION_INTERVAL_SECONDS: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(MEMORY_MANAGER.with(|m| m.borrow().get(DISTRIBUTION_INTERVAL_SECONDS_MEM_ID)), 3600).unwrap()
    );
    
    // Distribution event tracking
    pub static DISTRIBUTION_EVENTS: RefCell<StableBTreeMap<u64, DistributionEvent, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(DISTRIBUTION_EVENTS_MEM_ID)))
    );
    
    pub static NEXT_EVENT_ID: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(MEMORY_MANAGER.with(|m| m.borrow().get(NEXT_EVENT_ID_MEM_ID)), 0).unwrap()
    );
}

pub fn get_total_unclaimed_icp_reward_mem() -> StableBTreeMap<(), u64, Memory> {
    TOTAL_UNCLAIMED_ICP_REWARD.with(|reward_map| {
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(TOTAL_UNCLAIMED_ICP_REWARD_MEM_ID)),
        )
    })
}

pub fn get_secondary_ratio_mem() -> StableBTreeMap<(), SecondaryRatio, Memory> {
    SECONDARY_RATIO.with(|ratio_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(SECONDARY_RATIO_MEM_ID)))
    })
}
pub fn get_total_archived_balance_mem() -> StableBTreeMap<(), u64, Memory> {
    TOTAL_ARCHIVED_BALANCE.with(|balance_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(TOTAL_ARCHIVED_BALANCE_MEM_ID)))
    })
}

pub fn get_distribution_interval_mem() -> StableBTreeMap<(), u32, Memory> {
    DISTRIBUTION_INTERVALS.with(|interval_map| {
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(DISTRIBUTION_INTERVALS_MEM_ID)))
    })
}

pub fn add_to_lp_treasury(amount: u64) -> Result<(), ExecutionError> {
    LP_TREASURY.with(|cell| {
        let current_balance = *cell.borrow().get();
        let new_balance = current_balance.checked_add(amount).ok_or_else(|| ExecutionError::AdditionOverflow {
            operation: "add_to_lp_treasury".to_string(),
            details: "Overflow when adding to LP treasury".to_string()
        })?;
        cell.borrow_mut().set(new_balance).map_err(|_| ExecutionError::StateError("Failed to set LP treasury balance".to_string()))?;
        Ok(())
    })
}

pub fn withdraw_from_lp_treasury(amount: u64) -> Result<(), ExecutionError> {
    LP_TREASURY.with(|cell| {
        let current_balance = *cell.borrow().get();
        let new_balance = current_balance.checked_sub(amount).ok_or_else(|| ExecutionError::Underflow {
            operation: "withdraw_from_lp_treasury".to_string(),
            details: "Underflow when subtracting from LP treasury".to_string()
        })?;
        cell.borrow_mut().set(new_balance).map_err(|_| ExecutionError::StateError("Failed to set LP treasury balance".to_string()))?;
        Ok(())
    })
}

#[derive(CandidType, Deserialize, Clone)]
pub struct Stake {
    pub amount: u64,
    pub time: u64,
    pub reward_icp: u64,
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
    pub log_id: u64,
    pub timestamp: u64,
    pub caller: Principal,
    pub function: String,
    pub log_type: LogType,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Configs {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub tokenomics_cansiter_id: Principal,
    pub icp_ledger_id: Principal,
}
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum LogType {
    Info { detail: String },
    Error { error: ExecutionError },
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

#[derive(CandidType, Deserialize, Clone, Debug, Default)]
pub struct TreasuryState {
    pub next_earliest_provision_timestamp: u64,
}

impl Storable for TreasuryState {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

pub fn update_next_provision_timestamp(new_timestamp: u64) {
    TREASURY_STATE.with(|state| {
        let mut treasury_state = state.borrow().get().clone();
        treasury_state.next_earliest_provision_timestamp = new_timestamp;
        let _ = state.borrow_mut().set(treasury_state);
    });
}

pub fn get_accumulated_primary_tokens() -> u64 {
    ACCUMULATED_PRIMARY_TOKENS.with(|cell| *cell.borrow().get())
}

pub fn add_to_accumulated_primary_tokens(amount: u64) -> Result<(), ExecutionError> {
    ACCUMULATED_PRIMARY_TOKENS.with(|cell| {
        let current = *cell.borrow().get();
        let new_total = current.checked_add(amount)
            .ok_or_else(|| ExecutionError::AdditionOverflow {
                operation: "add_to_accumulated_primary_tokens".to_string(),
                details: format!("Current: {}, Adding: {}", current, amount),
            })?;
        cell.borrow_mut().set(new_total).map_err(|_| ExecutionError::StateError("Failed to update accumulated primary tokens".to_string()))?;
        Ok(())
    })
}

pub fn withdraw_from_accumulated_primary_tokens(amount: u64) -> Result<(), ExecutionError> {
    ACCUMULATED_PRIMARY_TOKENS.with(|cell| {
        let mut current = *cell.borrow().get();
        if current < amount {
            return Err(ExecutionError::InsufficientBalance {
                required: amount,
                available: current,
                token: "Primary".to_string(),
                details: "Accumulated primary tokens insufficient".to_string(),
            });
        }
        current = current.saturating_sub(amount);
        cell.borrow_mut().set(current).map_err(|_| ExecutionError::StateError("Failed to update accumulated primary tokens".to_string()))?;
        Ok(())
    })
}

// Distribution event helpers
pub fn get_next_event_id() -> u64 {
    NEXT_EVENT_ID.with(|cell| {
        let current = *cell.borrow().get();
        let next = current + 1;
        let _ = cell.borrow_mut().set(next);
        current
    })
}

pub fn store_distribution_event(event: DistributionEvent) -> Result<(), ExecutionError> {
    DISTRIBUTION_EVENTS.with(|events| {
        events.borrow_mut().insert(event.event_id, event);
        Ok(())
    })
}


// Storable implementations for new types
impl Storable for DistributionEvent {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
