use candid::{CandidType, Decode, Encode, Principal};
use ic_stable_structures::{
    memory_manager::{MemoryId, VirtualMemory},
    storable::Bound,
    DefaultMemoryImpl, StableBTreeMap, StableCell, Storable,
};
use serde::Deserialize;
use std::{borrow::Cow, cell::RefCell};

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Memory IDs for stable structures
pub const DEPLOYMENTS_MEM_ID: MemoryId = MemoryId::new(10);
pub const USER_ACTIVE_DEPLOYMENTS_MEM_ID: MemoryId = MemoryId::new(11);
pub const DEPLOYMENT_COUNTER_MEM_ID: MemoryId = MemoryId::new(12);

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub enum DeploymentStatus {
    Active,      // Deployment in progress
    Failed,      // Marked for cleanup
    Cleaning,    // Cleanup in progress
    Completed,   // Successfully deployed
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CreateTokenParams {
    pub primary_token_name: String,
    pub primary_token_symbol: String,
    pub primary_token_description: String,
    pub primary_logo: String,
    pub secondary_token_name: String,
    pub secondary_token_symbol: String,
    pub secondary_token_description: String,
    pub secondary_logo: String,
    pub primary_max_supply: u64,
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub halving_step: u64,
    pub threshold_multiplier: f64,
    pub initial_reward_per_burn_unit: u64,
    pub distribution_interval_seconds: u64,
    pub launch_delay_seconds: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Deployment {
    pub id: u64,
    pub version: u64,                    // For atomic updates
    pub user: Principal,
    pub payment_block: u64,
    pub payment_amount: u64,             // Track exact amount for refunds
    pub params: CreateTokenParams,       // Store for phase 2 execution
    pub status: DeploymentStatus,
    pub created_at: u64,
    pub last_activity: u64,              // For smart timeout
    pub failed_at: Option<u64>,
    pub created_canisters: Vec<Principal>,
    pub deleted_canisters: Vec<Principal>, // Track cleanup progress
    pub cleanup_attempts: u8,
    pub last_error: Option<String>,
    pub token_id: Option<u64>,           // Set on successful completion
}


#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DeploymentInfo {
    pub id: u64,
    pub status: String,
    pub created_at: u64,
    pub last_activity: u64,
    pub failed_at: Option<u64>,
    pub token_id: Option<u64>,
    pub canister_count: usize,
    pub cleanup_progress: u8,
    pub last_error: Option<String>,
}


#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TokenDeploymentResult {
    pub token_id: u64,
    pub message: String,
}

// We can remove this entirely - no need for conversion between deployment and token status

// Storable implementations
impl Storable for Deployment {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }
    const BOUND: Bound = Bound::Unbounded;
}

thread_local! {
    // Deployments by ID
    pub static DEPLOYMENTS: RefCell<StableBTreeMap<u64, Deployment, Memory>> = {
        RefCell::new(StableBTreeMap::init(
            crate::storage::MEMORY_MANAGER.with(|m| m.borrow().get(DEPLOYMENTS_MEM_ID))
        ))
    };
    
    // User -> Active Deployment ID mapping for fast lookup
    pub static USER_ACTIVE_DEPLOYMENTS: RefCell<StableBTreeMap<Principal, u64, Memory>> = {
        RefCell::new(StableBTreeMap::init(
            crate::storage::MEMORY_MANAGER.with(|m| m.borrow().get(USER_ACTIVE_DEPLOYMENTS_MEM_ID))
        ))
    };
    
    // Deployment counter
    pub static DEPLOYMENT_COUNTER: RefCell<StableCell<u64, Memory>> = {
        RefCell::new(StableCell::init(
            crate::storage::MEMORY_MANAGER.with(|m| m.borrow().get(DEPLOYMENT_COUNTER_MEM_ID)),
            0
        ).unwrap())
    };
}

// Helper functions
pub fn get_active_deployment_for_user(user: Principal) -> Option<u64> {
    USER_ACTIVE_DEPLOYMENTS.with(|index| {
        index.borrow().get(&user)
    })
}

pub fn atomic_update_deployment<F>(deployment_id: u64, updater: F) -> Result<(), String>
where 
    F: FnOnce(&mut Deployment) -> Result<(), String> 
{
    DEPLOYMENTS.with(|deployments| {
        let mut deps = deployments.borrow_mut();
        
        if let Some(mut deployment) = deps.get(&deployment_id) {
            let original_version = deployment.version;
            
            // Apply the update
            updater(&mut deployment)?;
            
            // Update metadata
            deployment.version = original_version + 1;
            deployment.last_activity = ic_cdk::api::time();
            
            // Save back
            deps.insert(deployment_id, deployment);
            Ok(())
        } else {
            Err("Deployment not found".to_string())
        }
    })
}

pub fn mark_deployment_failed(deployment_id: u64, error: String) {
    let user = DEPLOYMENTS.with(|deployments| {
        deployments.borrow().get(&deployment_id).map(|d| d.user)
    });
    
    if let Some(user) = user {
        // Update deployment status
        let _ = atomic_update_deployment(deployment_id, |d| {
            d.status = DeploymentStatus::Failed;
            d.failed_at = Some(ic_cdk::api::time());
            d.last_error = Some(error);
            Ok(())
        });
        
        // Remove from active index
        USER_ACTIVE_DEPLOYMENTS.with(|index| {
            index.borrow_mut().remove(&user);
        });
    }
}