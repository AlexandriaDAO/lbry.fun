use crate::get_config;

pub fn is_allowed() -> Result<(), String> {
    let caller = ic_cdk::api::caller();
    
    // Get the configured icp_swap canister ID from config
    if let Some(config) = get_config() {
        if caller == config.icp_swap_canister_id {
            Ok(())
        } else {
            Err("You are unauthorized to call this method.".to_string())
        }
    } else {
        Err("Configuration not initialized.".to_string())
    }
}
