use candid::Principal;
use pocket_ic::PocketIc;

use crate::helpers::shared_helpers::*;

#[test]
fn test_deployment_parameter_validation() {
    let mut pic = PocketIc::new();
    
    // Deploy lbry_fun canister
    let lbry_fun = deploy_lbry_fun(&mut pic);
    let user = Principal::anonymous();
    
    // Test cases for parameter validation
    let test_cases = vec![
        // Symbol validation tests
        (
            "symbol_too_short",
            CreateTokenParams {
                primary_token_symbol: "A".to_string(), // Too short (min 2)
                ..default_params()
            },
            "Primary token symbol must be 2-10 characters"
        ),
        (
            "symbol_too_long",
            CreateTokenParams {
                primary_token_symbol: "VERYLONGSYMBOL".to_string(), // Too long (max 10)
                ..default_params()
            },
            "Primary token symbol must be 2-10 characters"
        ),
        (
            "symbol_invalid_chars",
            CreateTokenParams {
                primary_token_symbol: "TEST-TOKEN".to_string(), // Contains hyphen
                ..default_params()
            },
            "Primary token symbol must contain only letters and numbers"
        ),
        
        // Name validation tests
        (
            "name_empty",
            CreateTokenParams {
                primary_token_name: "".to_string(),
                ..default_params()
            },
            "Primary token name cannot be empty"
        ),
        (
            "name_too_long",
            CreateTokenParams {
                primary_token_name: "A".repeat(101), // 101 chars (max 100)
                ..default_params()
            },
            "Primary token name too long (101/100 characters)"
        ),
        
        // Description validation tests
        (
            "description_empty",
            CreateTokenParams {
                primary_token_description: "".to_string(),
                ..default_params()
            },
            "Primary token description cannot be empty"
        ),
        (
            "description_too_long",
            CreateTokenParams {
                primary_token_description: "A".repeat(501), // 501 chars (max 500)
                ..default_params()
            },
            "Primary token description too long (501/500 characters)"
        ),
        
        // Logo validation tests
        (
            "logo_empty",
            CreateTokenParams {
                primary_logo: "".to_string(),
                ..default_params()
            },
            "Primary token logo is required"
        ),
        (
            "logo_invalid_base64",
            CreateTokenParams {
                primary_logo: "not!valid@base64#".to_string(),
                ..default_params()
            },
            "Primary token logo must be valid base64"
        ),
        (
            "logo_too_large",
            CreateTokenParams {
                primary_logo: "A".repeat(140_000), // > 100KB when decoded
                ..default_params()
            },
            "Primary token logo exceeds 100KB limit"
        ),
        
        // Hard cap validation tests
        (
            "hard_cap_too_low",
            CreateTokenParams {
                primary_max_supply: 999_999 * 100_000_000, // Less than 1M tokens
                ..default_params()
            },
            "Primary max supply must be at least 1000000 tokens"
        ),
        (
            "hard_cap_too_high",
            CreateTokenParams {
                primary_max_supply: 100_000_000_001u64 * 100_000_000, // More than 100B tokens
                ..default_params()
            },
            "Primary max supply cannot exceed 100000000000 tokens"
        ),
        
        // Initial reward validation tests
        (
            "reward_too_low",
            CreateTokenParams {
                initial_reward_per_burn_unit: 999_999, // Less than 0.01 tokens (1_000_000 E8S)
                ..default_params()
            },
            "Initial reward per burn unit must be at least 0.01 tokens"
        ),
        (
            "reward_too_high",
            CreateTokenParams {
                initial_reward_per_burn_unit: 21 * 100_000_000, // More than 20 tokens
                ..default_params()
            },
            "Initial reward per burn unit cannot exceed 20 tokens"
        ),
        
        // Initial secondary burn validation tests
        (
            "secondary_burn_too_low",
            CreateTokenParams {
                initial_secondary_burn: 999_999 * 100_000_000, // Less than 1M tokens
                ..default_params()
            },
            "Initial secondary burn must be at least 1000000 tokens"
        ),
        (
            "secondary_burn_too_high",
            CreateTokenParams {
                initial_secondary_burn: 100_000_001u64 * 100_000_000, // More than 100M tokens
                ..default_params()
            },
            "Initial secondary burn cannot exceed 100000000 tokens"
        ),
        
        // Halving step validation tests
        (
            "halving_step_too_low",
            CreateTokenParams {
                halving_step: 24, // Less than 25%
                ..default_params()
            },
            "Halving step must be between 25 and 99%"
        ),
        (
            "halving_step_too_high",
            CreateTokenParams {
                halving_step: 100, // 100% or more
                ..default_params()
            },
            "Halving step must be between 25 and 99%"
        ),
        
        // Threshold multiplier validation tests
        (
            "threshold_multiplier_too_low",
            CreateTokenParams {
                threshold_multiplier: 0.9, // Less than 1.0
                ..default_params()
            },
            "Threshold multiplier must be between 1.0 and 10.0"
        ),
        (
            "threshold_multiplier_too_high",
            CreateTokenParams {
                threshold_multiplier: 10.1, // More than 10.0
                ..default_params()
            },
            "Threshold multiplier must be between 1.0 and 10.0"
        ),

        // Distribution interval validation tests
        (
            "distribution_interval_too_low",
            CreateTokenParams {
                distribution_interval_seconds: 59, // Less than 60 seconds
                ..default_params()
            },
            "Distribution interval must be at least 60 seconds"
        ),
    ];
    
    for (test_name, params, expected_error) in test_cases {
        println!("Testing: {}", test_name);
        
        // Fund the user account
        fund_account(&mut pic, user, 10_000_000_000); // 100 ICP
        
        // Try to initiate deployment
        let result = pic.update_call(
            lbry_fun,
            user,
            "initiate_token_deployment",
            candid::encode_one(params).unwrap(),
        );
        
        match result {
            Ok(_) => {
                panic!("Test '{}' should have failed with error: {}", test_name, expected_error);
            }
            Err(e) => {
                let error_msg = format!("{:?}", e);
                assert!(
                    error_msg.contains(expected_error),
                    "Test '{}' failed with unexpected error.\nExpected: {}\nGot: {}",
                    test_name,
                    expected_error,
                    error_msg
                );
                println!("✓ Test '{}' failed as expected with: {}", test_name, expected_error);
            }
        }
        
        pic.advance_time(std::time::Duration::from_secs(1));
    }
}

#[test]
fn test_deployment_validation_valid_params() {
    let mut pic = PocketIc::new();
    
    // Deploy lbry_fun canister
    let lbry_fun = deploy_lbry_fun(&mut pic);
    let user = Principal::anonymous();
    
    // Fund the user account
    fund_account(&mut pic, user, 10_000_000_000); // 100 ICP
    
    // Valid parameters should succeed
    let valid_params = default_params();
    
    let result = pic.update_call(
        lbry_fun,
        user,
        "initiate_token_deployment",
        candid::encode_one(valid_params).unwrap(),
    );
    
    match result {
        Ok(response) => {
            let deployment_id: u64 = candid::decode_one(&response).unwrap();
            println!("✓ Valid deployment initiated with ID: {}", deployment_id);
            assert!(deployment_id > 0);
        }
        Err(e) => {
            panic!("Valid deployment should have succeeded, but failed with: {:?}", e);
        }
    }
}

// Helper function to create default valid parameters
fn default_params() -> CreateTokenParams {
    CreateTokenParams {
        primary_token_name: "Test Token".to_string(),
        primary_token_symbol: "TEST".to_string(),
        primary_token_description: "A test token for validation".to_string(),
        primary_logo: base64::encode("<?xml version=\"1.0\"?><svg><circle cx=\"50\" cy=\"50\" r=\"40\"/></svg>"),
        secondary_token_name: "Test Secondary".to_string(),
        secondary_token_symbol: "TESTS".to_string(),
        secondary_token_description: "A test secondary token".to_string(),
        secondary_logo: base64::encode("<?xml version=\"1.0\"?><svg><rect width=\"100\" height=\"100\"/></svg>"),
        primary_max_supply: 10_000_000 * 100_000_000, // 10M tokens in E8S
        initial_primary_mint: 0,
        initial_secondary_burn: 1_000_000 * 100_000_000, // 1M tokens in E8S
        halving_step: 90,
        threshold_multiplier: 1.5,
        initial_reward_per_burn_unit: 100_000_000, // 1 token in E8S
        distribution_interval_seconds: 3600,
    }
}

#[derive(Clone, candid::CandidType, candid::Deserialize)]
struct CreateTokenParams {
    pub primary_token_name: String,
    pub primary_token_symbol: String,
    pub primary_token_description: String,
    pub primary_logo: String,
    pub secondary_token_name: String,
    pub secondary_token_symbol: String,
    pub secondary_token_description: String,
    pub secondary_logo: String,
    pub primary_max_supply: u64,
    pub initial_primary_mint: u64,
    pub initial_secondary_burn: u64,
    pub halving_step: u64,
    pub threshold_multiplier: f64,
    pub initial_reward_per_burn_unit: u64,
    pub distribution_interval_seconds: u64,
}