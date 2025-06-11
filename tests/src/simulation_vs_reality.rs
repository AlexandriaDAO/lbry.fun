use candid::{CandidType, Decode, Encode, Nat, Principal};
use icrc_ledger_types::icrc::generic_value::Value;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::approve::{ApproveArgs, ApproveError};
use pocket_ic::{PocketIc, WasmResult};
use std::path::Path;
use std::env;

// Assuming the wasm files are in the root of the workspace after compilation.
// You may need to adjust these paths based on your build process.
const TOKENOMICS_WASM: &str = "target/wasm32-unknown-unknown/release/tokenomics.wasm";
const ICP_SWAP_WASM: &str = "target/wasm32-unknown-unknown/release/icp_swap.wasm";
const LOGS_WASM: &str = "target/wasm32-unknown-unknown/release/logs.wasm";
const ICRC1_LEDGER_WASM: &str = "src/ic-icrc1-ledger.wasm"; // Path to a pre-built ICRC1 ledger wasm

#[derive(CandidType)]
pub enum LedgerArgument {
    Init(LedgerInitArgs),
}

// Helper struct for ICRC1 init args
#[derive(candid::CandidType, Clone)]
pub struct LedgerInitArgs {
    minting_account: Account,
    initial_balances: Vec<(Account, Nat)>,
    transfer_fee: Nat,
    token_name: String,
    token_symbol: String,
    metadata: Vec<(String, Value)>,
    archive_options: ArchiveOptions,
}

#[derive(candid::CandidType, Clone)]
pub struct ArchiveOptions {
    trigger_threshold: usize,
    num_blocks_to_archive: usize,
    controller_id: Principal,
    cycles_for_archive_creation: Option<u64>,
    node_max_memory_size_bytes: Option<u32>,
    max_message_size_bytes: Option<u32>,
}

// Structs for your canisters' init args - replace with your actual structs
#[derive(candid::CandidType, Clone)]
struct TokenomicsInitArgs {
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    swap_canister_id: Option<Principal>,
    frontend_canister_id: Option<Principal>,
    max_primary_supply: u64,
    initial_primary_mint: u64,
    initial_secondary_burn: u64,
    max_primary_phase: u64,
    halving_step: u64,
    initial_reward_per_burn_unit: u64,
}
#[derive(candid::CandidType, Clone)]
struct IcpSwapInitArgs {
    primary_token_id: Option<Principal>,
    secondary_token_id: Option<Principal>,
    tokenomics_canister_id: Option<Principal>,
}

#[derive(candid::CandidType, Clone)]
struct LogsInitArgs {
    primary_token_id: Principal,
    secondary_token_id: Principal,
    icp_swap_id: Principal,
    tokenomics_id: Principal,
}

// Structs for GraphData and Log from your canisters
#[derive(candid::CandidType, serde::Deserialize, Debug)]
struct GraphData {
    cumulative_supply_data_x: Vec<u64>,
    cumulative_supply_data_y: Vec<u64>,
    minted_per_epoch_data_x: Vec<String>,
    minted_per_epoch_data_y: Vec<u64>,
    cost_to_mint_data_x: Vec<u64>,
    cost_to_mint_data_y: Vec<f64>,
    cumulative_usd_cost_data_x: Vec<u64>,
    cumulative_usd_cost_data_y: Vec<f64>,
}

#[derive(candid::CandidType, serde::Deserialize, Clone, Debug)]
struct Log {
    time: u64,
    primary_token_supply: Nat,
    secondary_token_supply: Nat,
    total_secondary_burned: u64,
    icp_in_lp_treasury: u64,
    total_primary_staked: Nat,
    staker_count: u64,
    apy: u128,
}

fn install_canister(
    pic: &PocketIc,
    canister_id: Principal,
    sender: Principal,
    wasm_path: &str,
    arg: Vec<u8>,
) {
    let wasm_bytes = std::fs::read(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(wasm_path),
    )
    .unwrap_or_else(|e| panic!("Failed to read Wasm file {}: {}", wasm_path, e));
    pic.install_canister(canister_id, wasm_bytes, arg, Some(sender));
}

fn setup() -> PocketIc {
    let dfx_version = "0.27.0";
    let pocket_ic_path = dirs::home_dir()
        .expect("Failed to get home dir")
        .join(".cache/dfinity/versions")
        .join(dfx_version)
        .join("pocket-ic");

    if !pocket_ic_path.exists() {
        panic!(
            "pocket-ic binary not found at {}. Please run 'dfx start'.",
            pocket_ic_path.display()
        );
    }
    std::env::set_var("POCKET_IC_BIN", pocket_ic_path);
    PocketIc::new()
}

#[test]
fn test_simulation_vs_reality() {
    // 1. SETUP THE UNIVERSE
    let pic = setup();
    let user = Principal::from_text("4vgwl-3fcra-iv6gc-oyih4-s33mm-tma3t-5fuy4-qir64-bqk5i-zlo6t-rae").unwrap();
    let controller = Principal::from_text("ffeoe-v7spt-7deo5-ujnp4-w5bgd-k7naw-pe36z-j54s6-eqip6-dquta-fae").unwrap();

    // Tokenomic Parameters
    const E8S: u64 = 100_000_000;
    let primary_max_supply = 1_000_000;
    let tge_allocation = 1;
    let initial_secondary_burn = 1_000_000;
    let halving_step = 70;
    let initial_reward_per_burn_unit = 2000;

    // Create canister principals ahead of time to resolve dependency cycle.
    let tokenomics_id = pic.create_canister();
    let icp_swap_id = pic.create_canister();
    let logs_id = pic.create_canister();
    let primary_token_id = pic.create_canister();
    let secondary_token_id = pic.create_canister();

    // Provide cycles to canisters
    let cycles = 2_000_000_000_000_000;
    pic.add_cycles(tokenomics_id, cycles);
    pic.add_cycles(icp_swap_id, cycles);
    pic.add_cycles(logs_id, cycles);
    pic.add_cycles(primary_token_id, cycles);
    pic.add_cycles(secondary_token_id, cycles);

    // Deploy ICRC1 Ledgers (Primary and Secondary Tokens)
    let primary_ledger_args = LedgerArgument::Init(LedgerInitArgs {
        minting_account: tokenomics_id.into(),
        initial_balances: vec![], // tokenomics canister is the minting account, it creates tokens via transfer
        transfer_fee: Nat::from(10_000u64),
        token_name: "Primary Token".to_string(),
        token_symbol: "PRM".to_string(),
        metadata: vec![],
        archive_options: ArchiveOptions {
            trigger_threshold: 2000,
            num_blocks_to_archive: 1000,
            controller_id: controller,
            cycles_for_archive_creation: Some(0),
            node_max_memory_size_bytes: None,
            max_message_size_bytes: None,
        },
    });
    install_canister(
        &pic,
        primary_token_id,
        user,
        ICRC1_LEDGER_WASM,
        candid::encode_one(primary_ledger_args).unwrap(),
    );

    let secondary_ledger_args = LedgerArgument::Init(LedgerInitArgs {
        minting_account: user.into(), // User can mint secondary tokens for the test
        initial_balances: vec![(user.into(), Nat::from(100_000_000_000_u64 * E8S))],
        transfer_fee: Nat::from(10_000u64),
        token_name: "Secondary Token".to_string(),
        token_symbol: "SCD".to_string(),
        metadata: vec![],
        archive_options: ArchiveOptions {
            trigger_threshold: 2000,
            num_blocks_to_archive: 1000,
            controller_id: controller,
            cycles_for_archive_creation: Some(0),
            node_max_memory_size_bytes: None,
            max_message_size_bytes: None,
        },
    });
    install_canister(
        &pic,
        secondary_token_id,
        user,
        ICRC1_LEDGER_WASM,
        candid::encode_one(secondary_ledger_args).unwrap(),
    );

    // Deploy your main canisters and wire them together
    let tokenomics_init = TokenomicsInitArgs {
        primary_token_id: Some(primary_token_id),
        secondary_token_id: Some(secondary_token_id),
        swap_canister_id: Some(icp_swap_id),
        frontend_canister_id: Some(controller), // Using controller as a placeholder
        max_primary_supply: primary_max_supply,
        initial_primary_mint: tge_allocation,
        initial_secondary_burn,
        max_primary_phase: 50,
        halving_step,
        initial_reward_per_burn_unit,
    };
    install_canister(
        &pic,
        tokenomics_id,
        user,
        TOKENOMICS_WASM,
        candid::encode_one(Some(tokenomics_init.clone())).unwrap(),
    );

    let icp_swap_init = IcpSwapInitArgs {
        primary_token_id: Some(primary_token_id),
        secondary_token_id: Some(secondary_token_id),
        tokenomics_canister_id: Some(tokenomics_id),
    };
    install_canister(
        &pic,
        icp_swap_id,
        user,
        ICP_SWAP_WASM,
        candid::encode_one(Some(icp_swap_init)).unwrap(),
    );

    let logs_init = LogsInitArgs {
        primary_token_id,
        secondary_token_id,
        icp_swap_id,
        tokenomics_id,
    };
    install_canister(
        &pic,
        logs_id,
        user,
        LOGS_WASM,
        candid::encode_one(logs_init).unwrap(),
    );

    // 2. GET THE "PLATONIC IDEAL" (THE SIMULATION)
    // The test assumes `preview_tokenomics` is on the `tokenomics` canister.
    // Based on the provided code, this function seems to be missing from the `tokenomics` canister's public API.
    // For this test to pass, we will create a parallel simulation inside the test itself,
    // using the same generation logic as `lbry_fun/src/simulation.rs`.
    // This removes the need to call an external canister for the simulation data.
    let sim_data =
        lbry_fun_simulation::preview_tokenomics(lbry_fun_simulation::PreviewArgs {
            primary_max_supply,
            tge_allocation,
            initial_secondary_burn,
            halving_step,
            initial_reward_per_burn_unit,
        });

    // Manually register the first log to capture the initial state (TGE)
    let res: WasmResult = pic
        .update_call(logs_id, user, "register_log", candid::encode_one(()).unwrap())
        .unwrap();
    assert!(!matches!(res, WasmResult::Reject(_)), "register_log call failed");

    // 3. RUN THE "MESSY REALITY"
    let burn_amounts = vec![1_000_000, 2_000_000, 4_000_000, 1_865_874];
    for burn_amount in burn_amounts {
        // 1. Approve the icp_swap canister to spend the user's secondary tokens.
        let approve_amount = Nat::from(burn_amount * E8S);
        let approve_args = ApproveArgs {
            from_subaccount: None,
            spender: icp_swap_id.into(),
            amount: approve_amount.clone(),
            expected_allowance: None,
            expires_at: None,
            fee: None,
            memo: None,
            created_at_time: None,
        };
        let approve_res_wasm = pic
            .update_call(
                secondary_token_id,
                user,
                "icrc2_approve",
                candid::encode_one(approve_args).unwrap(),
            )
            .unwrap();

        let approve_res: Result<(), ApproveError> = match approve_res_wasm {
            WasmResult::Reply(bytes) => Decode!(&bytes, Result<(), ApproveError>).unwrap(),
            WasmResult::Reject(e) => panic!("Approval rejected: {}", e),
        };

        assert!(approve_res.is_ok(), "Approval resulted in a ledger error: {:?}", approve_res.err());

        // 2. Call `burn_secondary` on the `icp_swap` canister.
        let burn_args = (burn_amount, Option::<[u8; 32]>::None);
        let burn_res: WasmResult = pic
            .update_call(icp_swap_id, user, "burn_secondary", candid::encode_one(burn_args).unwrap())
            .unwrap();
        assert!(
            !matches!(burn_res, WasmResult::Reject(_)),
            "burn_secondary call failed: {:?}",
            burn_res
        );

        // 3. Log the state after the burn.
        let log_res: WasmResult = pic
            .update_call(logs_id, user, "register_log", candid::encode_one(()).unwrap())
            .unwrap();
        assert!(
            !matches!(log_res, WasmResult::Reject(_)),
            "register_log call failed"
        );
    }

    // 4. COMPARE IDEAL VS. REALITY
    let logs_result_wasm = pic
        .query_call(logs_id, user, "get_all_logs", candid::encode_one(()).unwrap())
        .unwrap();
    
    let (real_logs,): (Vec<(u64, Log)>,) = match logs_result_wasm {
        WasmResult::Reply(bytes) => Decode!(&bytes, (Vec<(u64, Log)>,)).unwrap(),
        WasmResult::Reject(e) => panic!("get_all_logs rejected: {}", e),
    };

    println!(
        "Simulation Data Points: {}",
        sim_data.cumulative_supply_data_x.len()
    );
    println!("Real Log Entries: {}", real_logs.len());

    assert!(
        real_logs.len() > 1,
        "Not enough log entries to compare"
    );

    // Compare each real log entry against the simulation
    for (idx, (_, log_entry)) in real_logs.iter().enumerate() {
        if idx == 0 {
            // Check TGE state
            let real_minted: u64 = log_entry.primary_token_supply.0.clone().try_into().unwrap();
            let sim_minted_tge = sim_data.cumulative_supply_data_y[0];
            assert_eq!(
                real_minted, sim_minted_tge,
                "TGE Mismatch: Real {} vs Sim {}",
                real_minted, sim_minted_tge
            );
            continue;
        }

        let real_burn = log_entry.total_secondary_burned;
        let real_minted: u64 = log_entry.primary_token_supply.0.clone().try_into().unwrap();

        // Find the closest corresponding point in the simulation data
        let sim_idx = find_closest_burn_index(&sim_data.cumulative_supply_data_x, real_burn);

        let sim_burn = sim_data.cumulative_supply_data_x[sim_idx];
        let sim_minted = sim_data.cumulative_supply_data_y[sim_idx];

        println!(
            "Comparing Log #{}: Real Burn: {}, Real Minted: {} <==> Sim Burn: {}, Sim Minted: {}",
            idx, real_burn, real_minted, sim_burn, sim_minted
        );

        // We assert that the real minted value is very close to the simulated one.
        // A small tolerance might be needed due to integer arithmetic differences.
        let tolerance = 1; // Allow a tiny difference in e8s
        assert!(
            (real_minted as i128 - sim_minted as i128).abs() <= tolerance,
            "Mismatch at log entry {}: Real minted {} vs. Simulated minted {}",
            idx,
            real_minted,
            sim_minted
        );
    }
}

/// Helper to find the index of the simulation data point with the closest burn amount.
fn find_closest_burn_index(sim_burn_data: &[u64], real_burn: u64) -> usize {
    sim_burn_data
        .iter()
        .enumerate()
        .min_by_key(|&(_, &sim_burn)| (sim_burn as i128 - real_burn as i128).abs())
        .map(|(idx, _)| idx)
        .unwrap()
}

// To make this test self-contained, we will include the simulation logic directly.
// This logic is copied from `src/lbry_fun/src/simulation.rs` and `src/tokenomics/src/script.rs`
// to ensure the test uses the exact same "ideal" model as the live canister would.
mod lbry_fun_simulation {
    use super::{Nat, Principal};
    use candid::{CandidType, Deserialize};

    #[derive(CandidType, Deserialize, Clone, Default)]
    pub struct TokenomicsSchedule {
        pub secondary_burn_thresholds: Vec<u64>,
        pub primary_mint_per_threshold: Vec<u64>,
    }

    #[derive(CandidType, Deserialize, Clone)]
    pub struct PreviewArgs {
        pub primary_max_supply: u64,
        pub tge_allocation: u64,
        pub initial_secondary_burn: u64,
        pub halving_step: u64,
        pub initial_reward_per_burn_unit: u64,
    }

    #[derive(CandidType, Deserialize, Clone, Default, Debug)]
    pub struct GraphData {
        pub cumulative_supply_data_x: Vec<u64>,
        pub cumulative_supply_data_y: Vec<u64>,
        pub minted_per_epoch_data_x: Vec<String>,
        pub minted_per_epoch_data_y: Vec<u64>,
        pub cost_to_mint_data_x: Vec<u64>,
        pub cost_to_mint_data_y: Vec<f64>,
        pub cumulative_usd_cost_data_x: Vec<u64>,
        pub cumulative_usd_cost_data_y: Vec<f64>,
    }

    const SECONDARY_BURN_USD_COST: f64 = 0.005;
    const E8S: u128 = 100_000_000;

    pub fn preview_tokenomics(args: PreviewArgs) -> GraphData {
        let schedule = generate_tokenomics_schedule(
            args.initial_secondary_burn,
            args.initial_reward_per_burn_unit,
            args.primary_max_supply,
            args.halving_step,
        );

        let mut graph_data = GraphData::default();
        if schedule.secondary_burn_thresholds.is_empty() {
            return graph_data;
        }

        let max_primary_supply_e8s = (args.primary_max_supply as u128).saturating_mul(E8S);
        let tge_allocation_e8s = (args.tge_allocation as u128).saturating_mul(E8S);

        let mut total_primary_minted_e8s = tge_allocation_e8s;
        let mut total_secondary_burned = 0u128;

        graph_data
            .cumulative_supply_data_x
            .push(total_secondary_burned as u64);
        graph_data
            .cumulative_supply_data_y
            .push(total_primary_minted_e8s as u64);
        graph_data
            .cumulative_usd_cost_data_x
            .push(total_primary_minted_e8s as u64);
        graph_data.cumulative_usd_cost_data_y.push(0.0);
        graph_data.cost_to_mint_data_x.push(0);
        graph_data.cost_to_mint_data_y.push(0.0);
        graph_data
            .cost_to_mint_data_x
            .push(total_primary_minted_e8s as u64);
        graph_data.cost_to_mint_data_y.push(0.0);

        let mut last_secondary_burned_threshold = 0u128;

        for i in 0..schedule.secondary_burn_thresholds.len() {
            if total_primary_minted_e8s >= max_primary_supply_e8s {
                break;
            }

            let current_threshold = schedule.secondary_burn_thresholds[i] as u128;
            let epoch_secondary_burn_capacity =
                current_threshold.saturating_sub(last_secondary_burned_threshold);
            if epoch_secondary_burn_capacity == 0 {
                continue;
            }

            let reward_rate = schedule.primary_mint_per_threshold[i] as u128;
            if reward_rate == 0 {
                continue;
            }

            let potential_primary_mint_e8s = epoch_secondary_burn_capacity
                .saturating_mul(reward_rate)
                .saturating_mul(10000);
            let remaining_to_mint_e8s =
                max_primary_supply_e8s.saturating_sub(total_primary_minted_e8s);

            let (actual_primary_mint_e8s, actual_secondary_burned) =
                if potential_primary_mint_e8s > remaining_to_mint_e8s {
                    let secondary_needed_to_cap = if reward_rate > 0 {
                        remaining_to_mint_e8s
                            .saturating_div(reward_rate)
                            .saturating_div(10000)
                    } else {
                        0
                    };
                    (remaining_to_mint_e8s, secondary_needed_to_cap)
                } else {
                    (
                        potential_primary_mint_e8s,
                        epoch_secondary_burn_capacity,
                    )
                };

            if actual_primary_mint_e8s == 0 {
                continue;
            }

            let prev_total_primary_minted_e8s = total_primary_minted_e8s;
            total_primary_minted_e8s += actual_primary_mint_e8s;
            total_secondary_burned += actual_secondary_burned;

            graph_data
                .cumulative_supply_data_x
                .push(total_secondary_burned as u64);
            graph_data
                .cumulative_supply_data_y
                .push(total_primary_minted_e8s as u64);
            graph_data
                .minted_per_epoch_data_x
                .push(format!("Epoch {}", i + 1));
            graph_data
                .minted_per_epoch_data_y
                .push(actual_primary_mint_e8s as u64);

            let cumulative_usd_cost = (total_secondary_burned as f64) * SECONDARY_BURN_USD_COST;
            graph_data
                .cumulative_usd_cost_data_x
                .push(total_primary_minted_e8s as u64);
            graph_data
                .cumulative_usd_cost_data_y
                .push(cumulative_usd_cost);

            let cost_per_primary_token = if actual_primary_mint_e8s > 0 {
                (actual_secondary_burned as f64 * SECONDARY_BURN_USD_COST)
                    / (actual_primary_mint_e8s as f64 / E8S as f64)
            } else {
                0.0
            };

            graph_data
                .cost_to_mint_data_x
                .push(prev_total_primary_minted_e8s as u64);
            graph_data
                .cost_to_mint_data_y
                .push(cost_per_primary_token);
            graph_data
                .cost_to_mint_data_x
                .push(total_primary_minted_e8s as u64);
            graph_data
                .cost_to_mint_data_y
                .push(cost_per_primary_token);

            last_secondary_burned_threshold = current_threshold;
        }

        graph_data
    }

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

            let reward_e8s = (primary_per_threshold * in_slot_burn * 10000);
            let reward = reward_e8s / E8S;

            if one_reward_mode {
                let remaining_mint = max_primary_supply as u128 - total_minted;

                let final_burn = remaining_mint * 10000;

                let final_threshold = last_burn + final_burn;

                secondary_thresholds.push(final_threshold as u64);
                primary_rewards.push(1);

                total_minted += remaining_mint;
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
                primary_per_threshold =
                    std::cmp::max(1, (primary_per_threshold * halving_step as u128) / 100);
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
} 