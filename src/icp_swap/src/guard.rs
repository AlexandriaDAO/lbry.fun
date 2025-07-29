use candid::Principal;

use crate::STATE;

pub struct CallerGuard {
    principal: Principal,
}

impl CallerGuard {
    pub fn new(principal: Principal) -> Result<Self, String> {
        STATE.with(|state| {
            let pending_requests = &mut state.borrow_mut().pending_requests;
            if pending_requests.contains(&principal) {
                return Err(format!(
                    "Already processing a request for principal {:?}",
                    principal.to_string()
                ));
            }
            pending_requests.insert(principal);
            Ok(Self { principal })
        })
    }
}

impl Drop for CallerGuard {
    fn drop(&mut self) {
        STATE.with(|state| {
            state.borrow_mut().pending_requests.remove(&self.principal);
        })
    }
}

pub fn not_anon() -> Result<(), String> {
    let caller = ic_cdk::api::caller();
    if caller != Principal::anonymous() {
        Ok(())
    } else {
        Err("Anonymous principal not allowed to make calls.".to_string())
    }
}

pub fn only_lbry_fun() -> Result<(), String> {
    let caller = ic_cdk::api::caller();
    let lbry_fun_id = Principal::from_text("oni4e-oyaaa-aaaap-qp2pq-cai")
        .map_err(|_| "Invalid lbry_fun canister ID")?;
    
    if caller == lbry_fun_id {
        Ok(())
    } else {
        Err("Only lbry_fun canister can make this call".to_string())
    }
}
