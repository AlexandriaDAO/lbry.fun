mod storage;
pub use storage::*;
mod simulation;
pub use simulation::*;
mod queries;
pub use queries::*;
mod update;
pub use update::*;
mod utlis;
pub use utlis::*;
use icrc_ledger_types::icrc1::transfer::BlockIndex;
use icrc_ledger_types::icrc2::transfer_from::TransferFromError;
use candid::{CandidType, Deserialize, Principal};

#[derive(CandidType, Deserialize)]
pub struct LogsInitArgs {
    pub primary_token_id: Principal,
    pub secondary_token_id: Principal,
    pub icp_swap_id: Principal,
    pub tokenomics_id: Principal,
}

ic_cdk::export_candid!();
