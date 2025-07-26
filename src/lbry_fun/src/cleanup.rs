'''use ic_cdk::api::management_canister::main::{delete_canister, CanisterIdRecord};
use ic_cdk::Principal;

pub async fn delete_canisters(canisters: Vec<Principal>) {
    for canister in canisters {
        let canister_id_record = CanisterIdRecord {
            canister_id: canister,
        };
        let _ = delete_canister(canister_id_record).await;
    }
}
''