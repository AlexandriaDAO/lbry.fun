use crate::integrated_token_tests::TokenTestEnvironment;
use crate::shared_helpers::{ExecutionError, E8S};
use candid::{Encode, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use num_traits::cast::ToPrimitive;

/// Represents a tokenomics test case with expected results
#[derive(Debug, Clone)]
struct TokenomicsTestCase {
    name: String,
    config: TokenomicsConfig,
    burn_sequence: Vec<BurnOperation>,
    expected_results: Vec<ExpectedResult>,
}

#[derive(Debug, Clone)]
struct TokenomicsConfig {
    max_primary_supply: u64,
    initial_primary_mint: u64,
    initial_secondary_burn: u64,
    halving_step: u64,
    initial_reward_per_burn_unit: u64,
}

#[derive(Debug, Clone)]
struct BurnOperation {
    user: String,
    secondary_amount: u64, // Natural units (not e8s)
    at_total_burned: u64,  // State checkpoint
}

#[derive(Debug, Clone)]
struct ExpectedResult {
    primary_received: u64, // In e8s
    new_total_burned: u64, // In natural units
    current_threshold_index: Option<u32>,
    error_expected: Option<String>,
}

/// Reference implementation of tokenomics calculations
/// This matches the canister logic exactly for validation
struct TokenomicsCalculator {
    config: TokenomicsConfig,
    schedule: TokenomicsSchedule,
    total_burned: u64,
    total_minted: u64,
    current_threshold_index: u32,
}

#[derive(Debug, Clone)]
struct TokenomicsSchedule {
    secondary_burn_thresholds: Vec<u64>,
    primary_mint_per_threshold: Vec<u64>,
}

impl TokenomicsCalculator {
    fn new(config: TokenomicsConfig) -> Self {
        let schedule = generate_tokenomics_schedule(
            config.initial_secondary_burn,
            config.initial_reward_per_burn_unit,
            config.max_primary_supply,
            config.halving_step,
        );
        
        let initial_mint = config.initial_primary_mint;
        
        Self {
            config,
            schedule,
            total_burned: 0,
            total_minted: initial_mint,
            current_threshold_index: 0,
        }
    }
    
    fn calculate_burn_reward(&mut self, secondary_amount: u64) -> Result<BurnResult, String> {
        let tentative_total = self.total_burned + secondary_amount;
        
        // Check if we've reached the end
        if tentative_total > self.schedule.secondary_burn_thresholds.last().copied().unwrap_or(0) {
            return Err("Max primary reached, minting stopped!".to_string());
        }
        
        let mut phase_mint_primary = 0u64;
        let mut current_threshold_index = self.current_threshold_index;
        
        if tentative_total > self.schedule.secondary_burn_thresholds[current_threshold_index as usize] {
            let mut secondary_processed = 0u64;
            let mut temp_total_burned = self.total_burned;
            
            while tentative_total > self.schedule.secondary_burn_thresholds[current_threshold_index as usize] {
                let secondary_mint_primary_with_current_threshold = if temp_total_burned < self.schedule.secondary_burn_thresholds[current_threshold_index as usize] {
                    self.schedule.secondary_burn_thresholds[current_threshold_index as usize] - temp_total_burned
                } else {
                    secondary_amount - secondary_processed
                };
                
                let slot_mint = self.schedule.primary_mint_per_threshold[current_threshold_index as usize]
                    * secondary_mint_primary_with_current_threshold
                    * 10000;
                
                phase_mint_primary += slot_mint;
                secondary_processed += secondary_mint_primary_with_current_threshold;
                temp_total_burned += secondary_mint_primary_with_current_threshold;
                
                current_threshold_index += 1;
                if current_threshold_index >= self.schedule.secondary_burn_thresholds.len() as u32 {
                    current_threshold_index = (self.schedule.secondary_burn_thresholds.len() as u32) - 1;
                    break;
                }
            }
            
            // Process remaining
            if secondary_amount > secondary_processed {
                let remaining = secondary_amount - secondary_processed;
                let slot_mint = self.schedule.primary_mint_per_threshold[current_threshold_index as usize]
                    * remaining
                    * 10000;
                phase_mint_primary += slot_mint;
            }
        } else {
            phase_mint_primary = self.schedule.primary_mint_per_threshold[current_threshold_index as usize]
                * secondary_amount
                * 10000;
        }
        
        // Check 0.1% cap per transaction
        let max_phase_in_e8s = (self.config.max_primary_supply / 1000) * 100_000_000;
        if phase_mint_primary > max_phase_in_e8s {
            return Err(format!(
                "This would mint {} primary which exceeds the maximum of {} primary per transaction (0.1% of supply)",
                phase_mint_primary as f64 / 100_000_000.0,
                max_phase_in_e8s as f64 / 100_000_000.0
            ));
        }
        
        // Check if we have remaining supply
        let remaining_primary = self.config.max_primary_supply.saturating_sub(self.total_minted);
        let primary_to_mint = phase_mint_primary.min(remaining_primary);
        
        if primary_to_mint == 0 {
            return Err("No more primary can be minted".to_string());
        }
        
        // Update state
        self.total_burned += secondary_amount;
        self.total_minted += primary_to_mint / 100_000_000; // Convert from e8s
        self.current_threshold_index = current_threshold_index;
        
        Ok(BurnResult {
            primary_minted: primary_to_mint,
            new_total_burned: self.total_burned,
            current_threshold_index,
        })
    }
}

#[derive(Debug)]
struct BurnResult {
    primary_minted: u64, // In e8s
    new_total_burned: u64,
    current_threshold_index: u32,
}

/// Generate the tokenomics schedule (matches canister logic)
fn generate_tokenomics_schedule(
    initial_secondary_burn: u64,
    initial_reward_per_burn_unit: u64,
    max_primary_supply: u64,
    halving_step: u64,
) -> TokenomicsSchedule {
    let mut secondary_thresholds = Vec::new();
    let mut primary_rewards = Vec::new();
    
    let mut current_burn = initial_secondary_burn as u128;
    let mut last_burn = 0u128;
    let mut total_minted = 0u128;
    let mut primary_per_threshold = initial_reward_per_burn_unit as u128;
    
    let mut one_reward_mode = false;
    const E8S: u128 = 100_000_000;
    
    while total_minted < max_primary_supply as u128 {
        let in_slot_burn = current_burn - last_burn;
        let reward_e8s = primary_per_threshold * in_slot_burn * 10000;
        let reward = reward_e8s / E8S;
        
        if one_reward_mode {
            let remaining_mint = max_primary_supply as u128 - total_minted;
            let final_burn = remaining_mint * 10000;
            let final_threshold = last_burn + final_burn;
            
            secondary_thresholds.push(final_threshold as u64);
            primary_rewards.push(1);
            break;
        }
        
        if reward == 0 {
            break;
        }
        
        secondary_thresholds.push(current_burn as u64);
        primary_rewards.push(primary_per_threshold as u64);
        
        total_minted += reward;
        last_burn = current_burn;
        current_burn = current_burn * 2;
        
        if primary_per_threshold > 1 {
            primary_per_threshold = std::cmp::max(1, (primary_per_threshold * halving_step as u128) / 100);
        }
        
        if primary_per_threshold == 1 {
            one_reward_mode = true;
        }
    }
    
    TokenomicsSchedule {
        secondary_burn_thresholds: secondary_thresholds,
        primary_mint_per_threshold: primary_rewards,
    }
}

/// Generate comprehensive test cases
fn generate_test_cases() -> Vec<TokenomicsTestCase> {
    let mut cases = vec![];
    
    // Test Case 1: Bitcoin-like tokenomics (21M supply)
    let bitcoin_config = TokenomicsConfig {
        max_primary_supply: 21_000_000,
        initial_primary_mint: 2_100_000, // 10% TGE
        initial_secondary_burn: 5000,
        halving_step: 50, // 50% reduction per halving
        initial_reward_per_burn_unit: 1000,
    };
    
    // Single large burn test
    cases.push(TokenomicsTestCase {
        name: "bitcoin_like_single_large_burn".to_string(),
        config: bitcoin_config.clone(),
        burn_sequence: vec![
            BurnOperation {
                user: "alice".to_string(),
                secondary_amount: 1000,
                at_total_burned: 0,
            }
        ],
        expected_results: vec![
            ExpectedResult {
                primary_received: 1000 * 1000 * 10000, // 1000 * reward * 10000 (formula in canister doesn't multiply by e8s)
                new_total_burned: 1000,
                current_threshold_index: Some(0),
                error_expected: None,
            }
        ],
    });
    
    // Epoch boundary test
    cases.push(TokenomicsTestCase {
        name: "bitcoin_like_epoch_boundary".to_string(),
        config: bitcoin_config.clone(),
        burn_sequence: vec![
            BurnOperation {
                user: "alice".to_string(),
                secondary_amount: 4999,
                at_total_burned: 0,
            },
            BurnOperation {
                user: "bob".to_string(),
                secondary_amount: 2,
                at_total_burned: 4999,
            }
        ],
        expected_results: vec![
            ExpectedResult {
                primary_received: 4999 * 1000 * 10000,
                new_total_burned: 4999,
                current_threshold_index: Some(0),
                error_expected: None,
            },
            ExpectedResult {
                // This crosses the threshold: 1 at old rate, 1 at new rate
                primary_received: (1 * 1000 * 10000 + 1 * 500 * 10000),
                new_total_burned: 5001,
                current_threshold_index: Some(1),
                error_expected: None,
            }
        ],
    });
    
    // Test Case 2: Small token (1M supply)
    let small_config = TokenomicsConfig {
        max_primary_supply: 1_000_000,
        initial_primary_mint: 0, // No TGE
        initial_secondary_burn: 100,
        halving_step: 75, // 75% of previous rate
        initial_reward_per_burn_unit: 100,
    };
    
    cases.push(TokenomicsTestCase {
        name: "small_token_no_tge".to_string(),
        config: small_config.clone(),
        burn_sequence: vec![
            BurnOperation {
                user: "alice".to_string(),
                secondary_amount: 50,
                at_total_burned: 0,
            },
            BurnOperation {
                user: "bob".to_string(),
                secondary_amount: 50,
                at_total_burned: 50,
            },
            BurnOperation {
                user: "charlie".to_string(),
                secondary_amount: 100,
                at_total_burned: 100,
            }
        ],
        expected_results: vec![
            ExpectedResult {
                primary_received: 50 * 100 * 10000,
                new_total_burned: 50,
                current_threshold_index: Some(0),
                error_expected: None,
            },
            ExpectedResult {
                primary_received: 50 * 100 * 10000,
                new_total_burned: 100,
                current_threshold_index: Some(0), // May not cross yet at 100 burn
                error_expected: None,
            },
            ExpectedResult {
                primary_received: 100 * 100 * 10000, // Still at rate 100
                new_total_burned: 200,
                current_threshold_index: Some(0), // May still be in first threshold
                error_expected: None,
            }
        ],
    });
    
    // Test Case 3: Large token with 0.1% cap test
    let large_config = TokenomicsConfig {
        max_primary_supply: 1_000_000_000, // 1B
        initial_primary_mint: 50_000_000, // 5% TGE
        initial_secondary_burn: 50000,
        halving_step: 50,
        initial_reward_per_burn_unit: 10000,
    };
    
    cases.push(TokenomicsTestCase {
        name: "large_token_cap_test".to_string(),
        config: large_config.clone(),
        burn_sequence: vec![
            BurnOperation {
                user: "whale".to_string(),
                secondary_amount: 100000, // Try to burn a lot
                at_total_burned: 0,
            }
        ],
        expected_results: vec![
            ExpectedResult {
                primary_received: 0,
                new_total_burned: 0,
                current_threshold_index: None,
                error_expected: Some("exceeds the maximum".to_string()),
            }
        ],
    });
    
    cases
}

#[test]
fn test_tokenomics_calculations_comprehensive() {
    for test_case in generate_test_cases() {
        println!("\n=== Testing: {} ===", test_case.name);
        
        // Create fresh environment for each test case
        let mut env = TokenTestEnvironment::new();
        
        // Deploy with specific config
        env.deploy_with_config(
            test_case.config.max_primary_supply,
            test_case.config.initial_primary_mint,
            test_case.config.initial_secondary_burn,
            test_case.config.halving_step,
            test_case.config.initial_reward_per_burn_unit,
        );
        
        // Execute burn sequence
        for (i, (burn_op, expected)) in test_case.burn_sequence.iter()
            .zip(test_case.expected_results.iter())
            .enumerate() 
        {
            println!("\n  Burn #{}: {} burns {} secondary", i + 1, burn_op.user, burn_op.secondary_amount);
            
            // Setup user - use a valid principal
            let user = Principal::from_slice(&[i as u8 + 10; 29]);
            env.setup_user_with_secondary(user, burn_op.secondary_amount * 2); // Double to ensure enough
            
            // Get initial primary balance
            let initial_primary = env.get_user_balance(env.primary_token, user);
            
            // Execute burn
            let result = env.burn_secondary_for_user(user, burn_op.secondary_amount);
            
            if let Some(error_msg) = &expected.error_expected {
                // Expect error
                assert!(result.is_err(), "Expected error containing '{}', but got success", error_msg);
                let err = result.unwrap_err();
                assert!(err.contains(error_msg), "Expected error containing '{}', got: {}", error_msg, err);
                println!("    ✓ Got expected error: {}", err);
            } else {
                // Expect success
                assert!(result.is_ok(), "Burn failed unexpectedly: {:?}", result);
                
                // Check primary tokens received
                let final_primary = env.get_user_balance(env.primary_token, user);
                let primary_received = final_primary - initial_primary;
                
                // Allow for small rounding differences (within 0.01%)
                let expected_primary = expected.primary_received;
                let tolerance = expected_primary / 10000; // 0.01%
                
                assert!(
                    (primary_received as i128 - expected_primary as i128).abs() <= tolerance as i128,
                    "User {} burning {} secondary should receive {} primary (e8s), got {}",
                    burn_op.user, burn_op.secondary_amount, expected_primary, primary_received
                );
                
                println!("    ✓ Received {} primary tokens (e8s)", primary_received);
                
                // Verify total burned
                let total_burned = env.get_total_secondary_burned();
                assert_eq!(
                    total_burned, expected.new_total_burned,
                    "Total burned should be {}, got {}",
                    expected.new_total_burned, total_burned
                );
                println!("    ✓ Total burned: {} secondary", total_burned);
                
                // Verify threshold index if provided
                if let Some(expected_index) = expected.current_threshold_index {
                    let current_index = env.get_current_threshold_index();
                    assert_eq!(
                        current_index, expected_index,
                        "Current threshold index should be {}, got {}",
                        expected_index, current_index
                    );
                    println!("    ✓ Current threshold index: {}", current_index);
                }
            }
        }
        
        println!("\n✅ Test '{}' completed successfully", test_case.name);
    }
}

#[test]
fn test_tokenomics_differential() {
    let configs = vec![
        TokenomicsConfig {
            max_primary_supply: 21_000_000,
            initial_primary_mint: 0,
            initial_secondary_burn: 5000,
            halving_step: 50,
            initial_reward_per_burn_unit: 1000,
        },
        TokenomicsConfig {
            max_primary_supply: 100_000_000,
            initial_primary_mint: 10_000_000,
            initial_secondary_burn: 10000,
            halving_step: 75,
            initial_reward_per_burn_unit: 5000,
        },
    ];
    
    for config in configs {
        println!("\n=== Differential testing with config: max_supply={}, initial_burn={} ===", 
                 config.max_primary_supply, config.initial_secondary_burn);
        
        // Create fresh environment
        let mut env = TokenTestEnvironment::new();
        
        // Deploy with config
        env.deploy_with_config(
            config.max_primary_supply,
            config.initial_primary_mint,
            config.initial_secondary_burn,
            config.halving_step,
            config.initial_reward_per_burn_unit,
        );
        
        // Create reference calculator
        let mut calculator = TokenomicsCalculator::new(config.clone());
        
        // Test user
        let alice = Principal::from_slice(&[50; 29]);
        
        // Random burn operations
        // Use deterministic values instead of random for reproducibility
        let test_amounts = vec![10, 50, 100, 200, 500, 1, 999, 750, 25, 333, 666, 123, 456, 789, 321, 654, 987, 111, 222, 555];
        
        for (i, amount) in test_amounts.iter().enumerate() {
            let amount = *amount;
            
            // Setup user
            env.setup_user_with_secondary(alice, amount + 1000);
            
            // Get initial balance
            let initial_primary = env.get_user_balance(env.primary_token, alice);
            
            // Execute burn on canister
            let canister_result = env.burn_secondary_for_user(alice, amount);
            
            // Calculate expected result
            let calc_result = calculator.calculate_burn_reward(amount);
            
            match (canister_result, calc_result) {
                (Ok(_), Ok(calc)) => {
                    let final_primary = env.get_user_balance(env.primary_token, alice);
                    let canister_minted = final_primary - initial_primary;
                    
                    assert_eq!(
                        canister_minted, calc.primary_minted,
                        "Burn #{} of {} secondary: canister gave {} primary, calculator gave {}",
                        i + 1, amount, canister_minted, calc.primary_minted
                    );
                    
                    println!("  Burn #{}: {} secondary → {} primary ✓", i + 1, amount, canister_minted);
                }
                (Err(canister_err), Err(calc_err)) => {
                    // Both failed as expected
                    println!("  Burn #{}: {} secondary → Both correctly failed ✓", i + 1, amount);
                }
                (Ok(_), Err(calc_err)) => {
                    panic!("Burn #{}: Canister succeeded but calculator failed: {}", i + 1, calc_err);
                }
                (Err(canister_err), Ok(_)) => {
                    panic!("Burn #{}: Calculator succeeded but canister failed: {}", i + 1, canister_err);
                }
            }
        }
        
        println!("✅ Differential test passed for config");
    }
}

// Extension trait for TokenTestEnvironment to add custom deployment
trait TokenTestEnvironmentExt {
    fn deploy_with_config(
        &mut self,
        max_primary_supply: u64,
        initial_primary_mint: u64,
        initial_secondary_burn: u64,
        halving_step: u64,
        initial_reward_per_burn_unit: u64,
    );
    
    fn give_user_icp(&self, user: Principal, amount: u64);
    fn setup_user_with_secondary(&mut self, user: Principal, amount: u64);
    fn burn_secondary_for_user(&self, user: Principal, amount: u64) -> Result<String, String>;
    fn get_user_balance(&self, token_id: Principal, user: Principal) -> u64;
    fn get_total_secondary_burned(&self) -> u64;
    fn get_current_threshold_index(&self) -> u32;
}

// Include required modules
use crate::individual_canister_tests::{TokenomicsRealInitArgs, IcpSwapInitArgs, SecondaryRatio};

// WASM files
const TOKENOMICS_WASM: &[u8] = include_bytes!("../../../target/wasm32-unknown-unknown/release/tokenomics.wasm");
const ICP_SWAP_WASM: &[u8] = include_bytes!("../../../target/wasm32-unknown-unknown/release/icp_swap.wasm");

impl TokenTestEnvironmentExt for TokenTestEnvironment {
    fn deploy_with_config(
        &mut self,
        max_primary_supply: u64,
        initial_primary_mint: u64,
        initial_secondary_burn: u64,
        halving_step: u64,
        initial_reward_per_burn_unit: u64,
    ) {
        // Re-deploy tokenomics with custom config
        let init_args = Encode!(&Some(TokenomicsRealInitArgs {
            primary_token_id: Some(self.primary_token),
            secondary_token_id: Some(self.secondary_token),
            swap_canister_id: Some(self.icp_swap),
            frontend_canister_id: Some(Principal::anonymous()),
            max_primary_supply: max_primary_supply * E8S,
            initial_primary_mint: initial_primary_mint * E8S,
            initial_secondary_burn: initial_secondary_burn,
            halving_step,
            initial_reward_per_burn_unit,
        })).expect("Failed to encode tokenomics args");
        
        self.pic.reinstall_canister(
            self.tokenomics,
            TOKENOMICS_WASM.to_vec(),
            init_args,
            Some(Principal::anonymous()),
        );
        
        // Re-deploy icp_swap to match
        let init_args = Encode!(&Some(IcpSwapInitArgs {
            stakes: None,
            archived_transaction_log: None,
            total_unclaimed_icp_reward: None,
            secondary_ratio: Some(SecondaryRatio {
                ratio: 400,
                time: 0,
            }),
            total_archived_balance: None,
            apy: None,
            distribution_intervals: None,
            primary_token_id: Some(self.primary_token),
            secondary_token_id: Some(self.secondary_token),
            tokenomics_canister_id: Some(self.tokenomics),
            icp_ledger_id: Some(self.icp_ledger),
        })).expect("Failed to encode icp_swap args");
        
        self.pic.reinstall_canister(
            self.icp_swap,
            ICP_SWAP_WASM.to_vec(),
            init_args,
            Some(Principal::anonymous()),
        );
    }
    
    fn give_user_icp(&self, user: Principal, amount: u64) {
        // Transfer ICP from canister to user
        let transfer_args = Encode!(&icrc_ledger_types::icrc1::transfer::TransferArg {
            from_subaccount: None,
            to: Account {
                owner: user,
                subaccount: None,
            },
            amount: Nat::from(amount),
            fee: None,
            memo: None,
            created_at_time: None,
        }).expect("Failed to encode transfer args");
        
        self.pic.update_call(
            self.icp_ledger,
            self.icp_swap, // Transfer from icp_swap's balance
            "icrc1_transfer",
            transfer_args,
        ).expect("Failed to transfer ICP to user");
    }
    
    fn setup_user_with_secondary(&mut self, user: Principal, amount: u64) {
        // For very large amounts, we need a lot of ICP
        let icp_to_give = if amount > 10000 {
            100_000_000_000 // 1000 ICP for large amounts
        } else {
            10_000_000_000 // 100 ICP for normal amounts
        };
        
        // Give user ICP
        self.give_user_icp(user, icp_to_give);
        
        // Approve ICP for swap
        let approve_args = Encode!(&icrc_ledger_types::icrc2::approve::ApproveArgs {
            from_subaccount: None,
            spender: Account {
                owner: self.icp_swap,
                subaccount: None,
            },
            amount: Nat::from(icp_to_give),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        }).expect("Failed to encode approve args");
        
        self.pic.update_call(
            self.icp_ledger,
            user,
            "icrc2_approve",
            approve_args,
        ).expect("Failed to approve ICP");
        
        // Calculate how much ICP we need to swap to get desired secondary tokens
        // Secondary tokens are minted at rate * ICP amount
        // With rate = 400, 1 ICP (100M e8s) = 400 secondary tokens (in e8s)
        // So for amount secondary tokens in natural units, we need:
        // (amount * 100_000_000) / 400 ICP in e8s
        let icp_needed = ((amount + 1000) * 100_000_000) / 400; // Add larger buffer
        let swap_args = Encode!(&icp_needed, &None::<[u8; 32]>).expect("Failed to encode swap args");
        
        self.pic.update_call(
            self.icp_swap,
            user,
            "swap",
            swap_args,
        ).expect("Failed to swap for secondary tokens");
    }
    
    fn burn_secondary_for_user(&self, user: Principal, amount: u64) -> Result<String, String> {
        // First approve secondary tokens for burning
        let approve_args = Encode!(&icrc_ledger_types::icrc2::approve::ApproveArgs {
            from_subaccount: None,
            spender: Account {
                owner: self.icp_swap,
                subaccount: None,
            },
            amount: Nat::from(amount * 100_000_000), // Convert to e8s
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        }).expect("Failed to encode approve args");
        
        self.pic.update_call(
            self.secondary_token,
            user,
            "icrc2_approve",
            approve_args,
        ).expect("Failed to approve secondary tokens");
        
        // Now burn
        let burn_args = Encode!(&amount, &None::<[u8; 32]>).expect("Failed to encode burn args");
        
        match self.pic.update_call(
            self.icp_swap,
            user,
            "burn_secondary",
            burn_args,
        ) {
            Ok(reply) => {
                let result: Result<String, ExecutionError> = candid::decode_one(&reply)
                    .expect("Failed to decode burn result");
                result.map_err(|e| format!("{:?}", e))
            }
            Err(e) => Err(format!("Call failed: {}", e)),
        }
    }
    
    fn get_user_balance(&self, token_id: Principal, user: Principal) -> u64 {
        let account = Account {
            owner: user,
            subaccount: None,
        };
        let args = Encode!(&account).expect("Failed to encode account");
        
        let reply = self.pic.query_call(
            token_id,
            Principal::anonymous(),
            "icrc1_balance_of",
            args,
        ).expect("Failed to query balance");
        
        let balance: Nat = candid::decode_one(&reply).expect("Failed to decode balance");
        balance.0.to_u64().unwrap_or(0)
    }
    
    fn get_total_secondary_burned(&self) -> u64 {
        let reply = self.pic.query_call(
            self.tokenomics,
            Principal::anonymous(),
            "get_total_secondary_burn",
            Encode!().expect("Failed to encode empty args"),
        ).expect("Failed to query total burned");
        
        candid::decode_one(&reply).expect("Failed to decode total burned")
    }
    
    fn get_current_threshold_index(&self) -> u32 {
        let reply = self.pic.query_call(
            self.tokenomics,
            Principal::anonymous(),
            "get_current_threshold_index",
            Encode!().expect("Failed to encode empty args"),
        ).expect("Failed to query threshold index");
        
        candid::decode_one(&reply).expect("Failed to decode threshold index")
    }
}