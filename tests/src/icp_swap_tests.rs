use candid::{decode_one, Encode, Principal};
use crate::common::{setup_test_environment, Configs, InitArgs, ICP_SWAP_WASM};

#[test]
fn test_get_config() {
    let (pic, canister_id) = setup_test_environment();
    let sender = Principal::anonymous();

    let primary_token_id = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
    let secondary_token_id = Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap();
    let tokenomics_canister_id = Principal::from_text("ss2fx-dyaaa-aaaar-qacoq-cai").unwrap();

    let init_args = InitArgs {
        primary_token_id: Some(primary_token_id),
        secondary_token_id: Some(secondary_token_id),
        tokenomics_canister_id: Some(tokenomics_canister_id),
        ..Default::default()
    };

    let install_payload = Encode!(&Some(init_args)).expect("Failed to encode init args");

    pic.install_canister(
        canister_id,
        ICP_SWAP_WASM.to_vec(),
        install_payload,
        Some(sender),
    );

    let args = Encode!().expect("Failed to encode arguments");
    let result = pic.query_call(canister_id, sender, "get_config", args);

    match result {
        Ok(reply) => {
            let config = decode_one(&reply).expect("Failed to decode response");
            let _config: Configs = config;
            println!(
                "Successfully called get_config and decoded the response: {:?}",
                _config
            );
            assert_eq!(_config.primary_token_id, primary_token_id);
            assert_eq!(_config.secondary_token_id, secondary_token_id);
            assert_eq!(_config.tokenomics_cansiter_id, tokenomics_canister_id);
        }
        Err(user_error) => {
            panic!("Error calling canister: {}", user_error)
        }
    }
}