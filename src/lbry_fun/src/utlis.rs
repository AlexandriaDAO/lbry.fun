use candid::Principal;

pub fn get_principal(id: &str) -> Principal {
    Principal::from_text(id).expect(&format!("Invalid principal: {}", id))
}