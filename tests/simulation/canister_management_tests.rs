use candid::{decode_one, Encode, Nat, Principal};
use crate::simulation::common::{setup_test_environment, setup_lbry_fun_canister};

#[test]
fn test_get_canister_cycle_balance() {
    let (pic, canister_id) = setup_test_environment();
    let sender = setup_lbry_fun_canister(&pic, canister_id);

    let args = Encode!(&canister_id).expect("Failed to encode arguments");
    let result = pic.update_call(canister_id, sender, "get_canister_cycle_balance", args);

    match result {
        Ok(reply) => {
            let balance_result: Result<Nat, String> =
                decode_one(&reply).expect("Failed to decode response");

            match balance_result {
                Ok(balance) => {
                    println!("Canister cycle balance: {}", balance);
                    let balance_u128: u128 = balance.to_string().replace("_", "").parse().unwrap();
                    assert!(balance_u128 > 1_000_000_000_000);
                    assert!(balance_u128 <= 2_000_000_000_000);
                    println!("Successfully got canister cycle balance.");
                }
                Err(e) => {
                    panic!("Canister returned an error: {}", e);
                }
            }
        }
        Err(user_error) => {
            panic!("Error calling canister: {}", user_error)
        }
    }
}