use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api::call::CallResult;
use ic_cdk::{query, update};

#[derive(CandidType, Deserialize, Clone)]
pub struct AddTokenArgs {
    pub decimals: u8,
    pub fee: u64,
    pub name: String,
    pub symbol: String,
    pub token: String,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct AddTokenResult {
    pub token_id: u32,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum AddTokenResponse {
    Ok(AddTokenResult),
    Err(String),
}

#[derive(CandidType, Deserialize, Clone)]
pub struct AddPoolArgs {
    pub amount_0: String,
    pub amount_1: String,
    pub token_0: String,
    pub token_1: String,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct AddPoolResult {
    pub pool_id: u32,
    pub lp_token_id: u32,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum AddPoolResponse {
    Ok(AddPoolResult),
    Err(String),
}

// Mock state to track tokens and pools
use std::cell::RefCell;
use std::collections::HashMap;

thread_local! {
    static TOKENS: RefCell<HashMap<String, u32>> = RefCell::new(HashMap::new());
    static POOLS: RefCell<Vec<(String, String)>> = RefCell::new(Vec::new());
    static NEXT_TOKEN_ID: RefCell<u32> = RefCell::new(1);
    static NEXT_POOL_ID: RefCell<u32> = RefCell::new(1);
}

#[update]
fn add_token(args: AddTokenArgs) -> AddTokenResponse {
    let token_id = NEXT_TOKEN_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    });
    
    TOKENS.with(|tokens| {
        tokens.borrow_mut().insert(args.token.clone(), token_id);
    });
    
    AddTokenResponse::Ok(AddTokenResult { token_id })
}

#[update]
fn add_pool(args: AddPoolArgs) -> AddPoolResponse {
    let pool_id = NEXT_POOL_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    });
    
    POOLS.with(|pools| {
        pools.borrow_mut().push((args.token_0, args.token_1));
    });
    
    AddPoolResponse::Ok(AddPoolResult {
        pool_id,
        lp_token_id: pool_id + 1000, // Arbitrary LP token ID
    })
}

#[query]
fn get_tokens() -> Vec<(String, u32)> {
    TOKENS.with(|tokens| {
        tokens.borrow().iter().map(|(k, v)| (k.clone(), *v)).collect()
    })
}

#[query]
fn get_pools() -> Vec<(String, String)> {
    POOLS.with(|pools| pools.borrow().clone())
}