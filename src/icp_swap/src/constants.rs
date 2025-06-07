pub const KONG_BACKEND_CANISTER_ID: &str = "2ipq2-uqaaa-aaaar-qailq-cai";
pub const LBRY_FUN_CANISTER_ID: &str = "j362g-ziaaa-aaaap-qkt7q-cai";
pub const ICP_LEDGER_CANISTER_ID: &str = "nppha-riaaa-aaaal-ajf2q-cai";
pub const LIQUIDITY_DEPLOYMENT_CAP_E8S: u64 = 10 * 100_000_000; // 10 ICP
pub const LIQUIDITY_FEE_PERCENT: u64 = 1; 

// Liquidity Provision Constants
pub const MIN_ICP_FOR_PROVISION_E8S: u64 = 1 * 100_000_000; // 1 ICP
pub const COOLDOWN_PERIOD_NS: u64 = 1 * 60 * 60 * 1_000_000_000; // 1 hour (for failed checks)
pub const MIN_PROVISION_INTERVAL_NS: u64 = 1 * 60 * 60 * 1_000_000_000; // 1 hour
pub const MAX_PROVISION_INTERVAL_NS: u64 = 3 * 60 * 60 * 1_000_000_000; // 3 hours 