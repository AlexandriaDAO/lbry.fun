use candid::{CandidType, Nat, Principal};
use candid::{Decode, Deserialize, Encode};
use std::borrow::Cow;
use std::cell::RefCell;

use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{DefaultMemoryImpl, StableCell, Storable};
type Memory = VirtualMemory<DefaultMemoryImpl>;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager},
    StableBTreeMap,
};
pub const LOGS_MEM_ID: MemoryId = MemoryId::new(0);
pub const CONFIGS_MEM_ID: MemoryId = MemoryId::new(1);

thread_local! {

    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    pub static LOGS: RefCell<StableBTreeMap<u64, Log, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(LOGS_MEM_ID))
        )
    );

    pub static CONFIGS: RefCell<StableCell<Config, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(CONFIGS_MEM_ID)),
            Config {
                primary_token_id: Principal::anonymous(),
                secondary_token_id: Principal::anonymous(),
                icp_swap_id: Principal::anonymous(),
                tokenomics_id: Principal::anonymous(),
            }
        ).unwrap()
    );
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Config {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub icp_swap_id: Principal,
    pub tokenomics_id: Principal,
}

pub fn get_config() -> Config {
    CONFIGS.with(|c| c.borrow().get().clone())
}

const MAX_VALUE_SIZE: u32 = 300;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Log {
    pub time: u64,
    pub primary_token_supply: Nat,
    pub secondary_token_supply: Nat,
    pub total_secondary_burned: u64,
    pub icp_in_lp_treasury: u64,
    pub total_primary_staked: Nat,
    pub staker_count: u64,
    pub apy: u128,
}

impl Storable for Log {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: MAX_VALUE_SIZE,
        is_fixed_size: false,
    };
}

impl Storable for Config {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
