use ic_cdk::query;
use crate::{TokenRecord, TOKENS, get_self_icp_balance};
use crate::simulation::{preview_tokenomics, GraphData, PreviewArgs};

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

#[query]
async fn get_treasury_balance() -> Result<u64, String> {
    let canister_principal = ic_cdk::api::id();
    get_self_icp_balance(canister_principal).await
}

#[query]
fn preview_tokenomics_graphs(args: PreviewArgs) -> GraphData {
    preview_tokenomics(args)
}

