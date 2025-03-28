use std::{borrow::Cow, cell::RefCell};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory}, storable::Bound, DefaultMemoryImpl, StableBTreeMap, Storable
};
use candid::{CandidType, Decode, Encode, Principal};
use serde::{Deserialize, Serialize};

type Memory = VirtualMemory<DefaultMemoryImpl>;
pub const MEM_ID: MemoryId = MemoryId::new(0);

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
struct TokenIds(Vec<String>); 

impl Storable for TokenIds {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}


thread_local! {
    // Initialize memory manager
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

  pub  static TOKEN_STORAGE: RefCell<StableBTreeMap<Principal, TokenIds, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEM_ID)) // Bind to VirtualMemory
        )
    );
}
