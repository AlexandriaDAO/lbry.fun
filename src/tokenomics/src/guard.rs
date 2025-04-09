use crate::get_config;

pub fn is_allowed() -> Result<(), String> {
    let swap_canister_id = get_config().swap_canister_id;

    if ic_cdk::api::caller() == swap_canister_id {
        Ok(())
    } else {
        Err("You are unauthorized to call this method.".to_string())
    }
}
