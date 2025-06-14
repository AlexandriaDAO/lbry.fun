use candid::{decode_one, Encode, Principal, CandidType, Deserialize};
use pocket_ic::PocketIc;
use std::collections::HashMap;
use num_traits::cast::ToPrimitive;

// Constants
const E8S: u64 = 100_000_000;
const ICP_TRANSFER_FEE: u64 = 10_000;

// Include WASM files
const TOKENOMICS_WASM: &[u8] = include_bytes!("../target/wasm32-unknown-unknown/release/tokenomics.wasm");
const ICP_SWAP_WASM: &[u8] = include_bytes!("../target/wasm32-unknown-unknown/release/icp_swap.wasm");
const LOGS_WASM: &[u8] = include_bytes!("../target/wasm32-unknown-unknown/release/logs.wasm");
const ICRC1_LEDGER_WASM: &[u8] = include_bytes!("../src/lbry_fun/src/ic-icrc1-ledger.wasm");
// Using ICRC1 ledger for ICP as well for testing
const ICP_LEDGER_WASM: &[u8] = include_bytes!("../src/lbry_fun/src/ic-icrc1-ledger.wasm");

// Import types from individual_canister_tests
use crate::individual_canister_tests::{TokenomicsInitArgs, IcpSwapInitArgs, LogsInitArgs, LedgerArg, InitArgs, FeatureFlags, ArchiveOptions, Account, MetadataValue};

// ICP Ledger specific types
#[derive(CandidType, Deserialize)]
struct LedgerCanisterInitPayload {
    minting_account: String,
    initial_values: Vec<(String, Tokens)>,
    send_whitelist: Vec<Principal>,
    transfer_fee: Option<Tokens>,
    token_symbol: Option<String>,
    token_name: Option<String>,
}

#[derive(CandidType, Deserialize)]
struct Tokens {
    e8s: u64,
}

#[derive(CandidType, Deserialize)]
enum LedgerCanisterPayload {
    Init(LedgerCanisterInitPayload),
}

// Test environment that wires together all 5 canisters
pub struct TokenTestEnvironment {
    pub pic: PocketIc,
    pub primary_token: Principal,
    pub secondary_token: Principal,
    pub tokenomics: Principal,
    pub icp_swap: Principal,
    pub logs: Principal,
    pub icp_ledger: Principal,
    pub test_users: HashMap<String, Principal>,
}

#[derive(CandidType, Deserialize)]
struct Icrc2ApproveArgs {
    from_subaccount: Option<[u8; 32]>,
    spender: Account,
    amount: candid::Nat,
    expected_allowance: Option<candid::Nat>,
    expires_at: Option<u64>,
    fee: Option<candid::Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize)]
struct SwapArgs {
    amount: u64,
    subaccount: Option<[u8; 32]>,
}

#[derive(CandidType, Deserialize)]
struct BurnSecondaryArgs {
    amount_to_burn: u64,
    subaccount: Option<[u8; 32]>,
}

#[derive(CandidType, Deserialize)]
struct StakeArgs {
    amount: u64,
}

#[derive(CandidType, Deserialize)]
enum SwapResult {
    Ok { amount: u64 },
    Err(String),
}

#[derive(CandidType, Deserialize)]
enum BurnResult {
    Ok { icp_returned: u64, primary_minted: u64 },
    Err(String),
}

impl TokenTestEnvironment {
    pub fn new() -> Self {
        let pic = PocketIc::new();
        
        // Create canisters
        let primary_token = pic.create_canister();
        let secondary_token = pic.create_canister();
        let tokenomics = pic.create_canister();
        let icp_swap = pic.create_canister();
        let logs = pic.create_canister();
        let icp_ledger = pic.create_canister();
        
        // Add cycles to all canisters
        for canister in &[primary_token, secondary_token, tokenomics, icp_swap, logs, icp_ledger] {
            pic.add_cycles(*canister, 10_000_000_000_000);
        }
        
        // Create test users with valid principal IDs
        let mut test_users = HashMap::new();
        test_users.insert("alice".to_string(), Principal::from_slice(&[1; 29]));
        test_users.insert("bob".to_string(), Principal::from_slice(&[2; 29]));
        test_users.insert("charlie".to_string(), Principal::from_slice(&[3; 29]));
        
        let mut env = Self {
            pic,
            primary_token,
            secondary_token,
            tokenomics,
            icp_swap,
            logs,
            icp_ledger,
            test_users,
        };
        
        // Initialize all canisters
        env.initialize_canisters();
        
        env
    }
    
    fn initialize_canisters(&mut self) {
        // 1. Deploy ICP Ledger
        self.deploy_icp_ledger();
        
        // 2. Deploy Primary Token
        self.deploy_icrc1_token(self.primary_token, "Test Primary", "TPT", self.tokenomics, 8);
        
        // 3. Deploy Secondary Token  
        self.deploy_icrc1_token(self.secondary_token, "Test Secondary", "TST", self.icp_swap, 8);
        
        // 4. Deploy Tokenomics
        self.deploy_tokenomics();
        
        // 5. Deploy ICP Swap
        self.deploy_icp_swap();
        
        // 6. Deploy Logs
        self.deploy_logs();
        
        println!("✓ All canisters deployed and initialized");
    }
    
    fn deploy_icp_ledger(&self) {
        // Deploy ICP ledger using ICRC1 format with initial balances for test users
        let init_balances = vec![
            (
                Account {
                    owner: self.test_users["alice"],
                    subaccount: None,
                },
                candid::Nat::from(1000 * E8S),
            ),
            (
                Account {
                    owner: self.test_users["bob"],
                    subaccount: None,
                },
                candid::Nat::from(1000 * E8S),
            ),
            (
                Account {
                    owner: self.test_users["charlie"],
                    subaccount: None,
                },
                candid::Nat::from(1000 * E8S),
            ),
            (
                Account {
                    owner: self.icp_swap,
                    subaccount: None,
                },
                candid::Nat::from(10000 * E8S),
            ),
        ];
        
        let init_args = Encode!(&LedgerArg::Init(
            InitArgs {
                decimals: Some(8),
                token_symbol: "ICP".to_string(),
                token_name: "Internet Computer".to_string(),
                minting_account: Account {
                    owner: Principal::anonymous(),
                    subaccount: None,
                },
                initial_balances: init_balances,
                metadata: vec![],
                maximum_number_of_accounts: None,
                accounts_overflow_trim_quantity: None,
                fee_collector_account: None,
                transfer_fee: candid::Nat::from(ICP_TRANSFER_FEE),
                feature_flags: Some(FeatureFlags { icrc2: true }),
                max_memo_length: None,
                archive_options: ArchiveOptions {
                    num_blocks_to_archive: 10_000,
                    max_transactions_per_response: None,
                    trigger_threshold: 10_000,
                    max_message_size_bytes: None,
                    cycles_for_archive_creation: None,
                    node_max_memory_size_bytes: None,
                    controller_id: Principal::anonymous(),
                },
            }
        ))
        .expect("Failed to encode ICP ledger init args");
        
        self.pic.install_canister(
            self.icp_ledger,
            ICP_LEDGER_WASM.to_vec(),
            init_args,
            Some(Principal::anonymous()),
        );
        
        println!("✓ ICP Ledger deployed at: {}", self.icp_ledger);
    }
    
    fn deploy_icrc1_token(&self, canister_id: Principal, name: &str, symbol: &str, minting_account: Principal, decimals: u8) {
        // Deploy ICRC1 token with proper initialization
        let init_args = Encode!(&LedgerArg::Init(
            InitArgs {
                decimals: Some(decimals),
                token_symbol: symbol.to_string(),
                token_name: name.to_string(),
                minting_account: Account {
                    owner: minting_account,
                    subaccount: None,
                },
                initial_balances: vec![],
                metadata: vec![],
                maximum_number_of_accounts: None,
                accounts_overflow_trim_quantity: None,
                fee_collector_account: None,
                transfer_fee: candid::Nat::from(10_000u64),
                feature_flags: Some(FeatureFlags { icrc2: true }),
                max_memo_length: None,
                archive_options: ArchiveOptions {
                    num_blocks_to_archive: 10_000,
                    max_transactions_per_response: None,
                    trigger_threshold: 10_000,
                    max_message_size_bytes: None,
                    cycles_for_archive_creation: None,
                    node_max_memory_size_bytes: None,
                    controller_id: Principal::anonymous(),
                },
            }
        ))
        .expect("Failed to encode ICRC1 init args");
        
        self.pic.install_canister(
            canister_id,
            ICRC1_LEDGER_WASM.to_vec(),
            init_args,
            Some(Principal::anonymous()),
        );
        
        println!("✓ {} token deployed at: {}", name, canister_id);
    }
    
    fn deploy_tokenomics(&self) {
        // Deploy tokenomics with test parameters
        let init_args = candid::Encode!(&Some(TokenomicsInitArgs {
            primary_token_id: Some(self.primary_token),
            secondary_token_id: Some(self.secondary_token),
            swap_canister_id: Some(self.icp_swap),
            frontend_canister_id: Some(Principal::anonymous()), // Use anonymous for testing
            max_primary_supply: 1_000_000 * E8S,
            initial_primary_mint: 10_000 * E8S,
            initial_secondary_burn: 5_000 * E8S,
            max_primary_phase: 100_000 * E8S,
            halving_step: 50, // Percentage value between 25 and 90
            initial_reward_per_burn_unit: 100,
        })).expect("Failed to encode tokenomics args");
        
        self.pic.install_canister(
            self.tokenomics,
            TOKENOMICS_WASM.to_vec(),
            init_args,
            Some(Principal::anonymous()),
        );
        
        println!("✓ Tokenomics deployed");
    }
    
    fn deploy_icp_swap(&self) {
        // Deploy ICP swap
        let init_args = candid::Encode!(&Some(IcpSwapInitArgs {
            primary_token_id: Some(self.primary_token),
            secondary_token_id: Some(self.secondary_token),
            tokenomics_canister_id: Some(self.tokenomics),
        })).expect("Failed to encode icp_swap args");
        
        self.pic.install_canister(
            self.icp_swap,
            ICP_SWAP_WASM.to_vec(),
            init_args,
            Some(Principal::anonymous()),
        );
        
        println!("✓ ICP Swap deployed");
    }
    
    fn deploy_logs(&self) {
        // Deploy logs canister
        let init_args = candid::Encode!(&LogsInitArgs {
            primary_token_id: self.primary_token,
            secondary_token_id: self.secondary_token,
            icp_swap_id: self.icp_swap,
            tokenomics_id: self.tokenomics,
        }).expect("Failed to encode logs args");
        
        self.pic.install_canister(
            self.logs,
            LOGS_WASM.to_vec(),
            init_args,
            Some(Principal::anonymous()),
        );
        
        println!("✓ Logs deployed");
    }
    
    // User operations
    pub fn mint_secondary(&self, user: &str, icp_amount: u64) -> Result<u64, String> {
        let user_principal = self.test_users[user];
        
        // First approve ICP transfer
        self.approve_icp(user, self.icp_swap, icp_amount + ICP_TRANSFER_FEE);
        
        // Call swap on icp_swap
        let args = Encode!(&SwapArgs {
            amount: icp_amount,
            subaccount: None,
        }).expect("Failed to encode swap args");
        
        let result = self.pic.update_call(
            self.icp_swap,
            user_principal,
            "swap",
            args,
        );
        
        match result {
            Ok(reply) => {
                let swap_result: SwapResult = decode_one(&reply)
                    .expect("Failed to decode swap result");
                match swap_result {
                    SwapResult::Ok { amount } => Ok(amount),
                    SwapResult::Err(e) => Err(e),
                }
            }
            Err(e) => Err(format!("Swap call failed: {}", e)),
        }
    }
    
    pub fn burn_secondary(&self, user: &str, amount: u64) -> Result<(u64, u64), String> {
        let user_principal = self.test_users[user];
        
        // Call burn_secondary on icp_swap
        let args = Encode!(&BurnSecondaryArgs {
            amount_to_burn: amount,
            subaccount: None,
        }).expect("Failed to encode burn args");
        
        let result = self.pic.update_call(
            self.icp_swap,
            user_principal,
            "burn_secondary",
            args,
        );
        
        match result {
            Ok(reply) => {
                let burn_result: BurnResult = decode_one(&reply)
                    .expect("Failed to decode burn result");
                match burn_result {
                    BurnResult::Ok { icp_returned, primary_minted } => Ok((icp_returned, primary_minted)),
                    BurnResult::Err(e) => Err(e),
                }
            }
            Err(e) => Err(format!("Burn call failed: {}", e)),
        }
    }
    
    pub fn stake_primary(&self, user: &str, amount: u64) -> Result<(), String> {
        let user_principal = self.test_users[user];
        
        // First approve primary token transfer
        self.approve_token(user, self.primary_token, self.icp_swap, amount);
        
        // Call stake on icp_swap
        let args = Encode!(&StakeArgs { amount }).expect("Failed to encode stake args");
        
        let result = self.pic.update_call(
            self.icp_swap,
            user_principal,
            "stake",
            args,
        );
        
        match result {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Stake call failed: {}", e)),
        }
    }
    
    pub fn advance_time(&mut self, seconds: u64) {
        // Advance pocket-ic time
        self.pic.advance_time(std::time::Duration::from_secs(seconds));
    }
    
    pub fn trigger_distribution(&self) -> Result<(), String> {
        // Call distribute_rewards on icp_swap
        let args = Encode!().expect("Failed to encode empty args");
        
        let result = self.pic.update_call(
            self.icp_swap,
            Principal::anonymous(),
            "distribute_rewards",
            args,
        );
        
        match result {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Distribution failed: {}", e)),
        }
    }
    
    // Helper methods
    fn approve_icp(&self, user: &str, spender: Principal, amount: u64) {
        let user_principal = self.test_users[user];
        
        // ICRC2 approve
        let args = Encode!(&Icrc2ApproveArgs {
            from_subaccount: None,
            spender: Account {
                owner: spender,
                subaccount: None,
            },
            amount: candid::Nat::from(amount),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        })
        .expect("Failed to encode approve args");
        
        let result = self.pic.update_call(
            self.icp_ledger,
            user_principal,
            "icrc2_approve",
            args,
        );
        
        match result {
            Ok(_) => println!("✓ {} approved {} ICP to {}", user, amount, spender),
            Err(e) => panic!("Failed to approve ICP: {}", e),
        }
    }
    
    fn approve_token(&self, user: &str, token: Principal, spender: Principal, amount: u64) {
        let user_principal = self.test_users[user];
        
        // ICRC2 approve
        let args = Encode!(&Icrc2ApproveArgs {
            from_subaccount: None,
            spender: Account {
                owner: spender,
                subaccount: None,
            },
            amount: candid::Nat::from(amount),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        })
        .expect("Failed to encode approve args");
        
        let result = self.pic.update_call(
            token,
            user_principal,
            "icrc2_approve",
            args,
        );
        
        match result {
            Ok(_) => println!("✓ {} approved {} tokens to {}", user, amount, spender),
            Err(e) => panic!("Failed to approve token: {}", e),
        }
    }
    
    pub fn get_balance(&self, user: &str, token: Principal) -> u64 {
        let user_principal = self.test_users[user];
        
        let args = Encode!(&Account {
            owner: user_principal,
            subaccount: None,
        })
        .expect("Failed to encode balance args");
        
        let result = self.pic.query_call(
            token,
            Principal::anonymous(),
            "icrc1_balance_of",
            args,
        );
        
        match result {
            Ok(reply) => {
                let balance: candid::Nat = decode_one(&reply)
                    .expect("Failed to decode balance");
                balance.0.to_u64().unwrap_or(0)
            }
            Err(e) => {
                println!("Warning: Failed to get balance: {}", e);
                0
            }
        }
    }
    
    pub fn get_staked_balance(&self, user: &str) -> u64 {
        // Get staked primary token balance
        0
    }
    
    pub fn get_unclaimed_rewards(&self, user: &str) -> u64 {
        // Get unclaimed ICP rewards
        0
    }
}

// Basic test to verify setup works
#[test]
pub fn test_environment_setup() {
    let env = TokenTestEnvironment::new();
    
    assert_ne!(env.primary_token, Principal::anonymous());
    assert_ne!(env.secondary_token, Principal::anonymous());
    assert_ne!(env.tokenomics, Principal::anonymous());
    assert_ne!(env.icp_swap, Principal::anonymous());
    assert_ne!(env.logs, Principal::anonymous());
    
    println!("✓ Test environment created successfully");
}

// Test basic secondary minting
#[test]
#[ignore] // Ignore until we implement the mock ICP ledger
pub fn test_mint_secondary_tokens() {
    let env = TokenTestEnvironment::new();
    
    // Alice mints secondary tokens with 10 ICP
    let secondary_amount = env.mint_secondary("alice", 10 * E8S)
        .expect("Failed to mint secondary tokens");
    
    // At default rate, should get tokens worth $0.01 each
    // Assuming ICP price is set in the test
    assert!(secondary_amount > 0);
    
    // Check Alice's secondary token balance
    let balance = env.get_balance("alice", env.secondary_token);
    assert_eq!(balance, secondary_amount);
    
    println!("✓ Successfully minted {} secondary tokens", secondary_amount);
}