use candid::Principal;

// Codebase version - Update this when making changes to the codebase
pub const CODEBASE_VERSION: &str = "0.1.0";

// Admin principal
const ADMIN_PRINCIPAL_STR: &str = "56kka-oe6xl-acccy-6cc5r-odus2-insgr-kk5ch-3d5i5-rwoit-3juc3-jqe";

// Canister IDs
pub const LBRY_FUN_CANISTER_ID: &str = "oni4e-oyaaa-aaaap-qp2pq-cai";
pub const KONG_BACKEND_CANISTER_ID: &str = "2ipq2-uqaaa-aaaar-qailq-cai";
pub const ICP_LEDGER_CANISTER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";

// Check if a principal is an admin
pub fn is_admin_principal(principal: &Principal) -> bool {
    match Principal::from_text(ADMIN_PRINCIPAL_STR) {
        Ok(admin) => principal == &admin,
        Err(_) => false,
    }
}