use ic_cdk::{query, update};

use crate::{TokenRecord, TOKENS};

#[query]
pub fn get_all_token_record() -> Vec<(u64, TokenRecord)> {
    TOKENS.with(|tokens| {
        let tokens_map = tokens.borrow();

        // return a Vec of tuples
        tokens_map
            .iter()
            .map(|(principal, stake)| (principal.clone(), stake.clone())) // Clone to ensure ownership
            .collect()
    })
}


#[query]
pub fn get_upcomming() -> Vec<(u64, TokenRecord)> {
    TOKENS.with(|tokens| {
        let tokens_map = tokens.borrow();

        tokens_map
            .iter()
            .filter(|(_, token)| token.is_live == false)
            .map(|(id, token)| (id.clone(), token.clone()))
            .collect()
    })
}
#[query]
pub fn get_live() -> Vec<(u64, TokenRecord)> {
    TOKENS.with(|tokens| {
        let tokens_map = tokens.borrow();

        tokens_map
            .iter()
            .filter(|(_, token)| token.is_live == true)
            .map(|(id, token)| (id.clone(), token.clone()))
            .collect()
    })
}

