// Debug utilities for investigating the 0.14 ICP discrepancy
// This file can be included temporarily for investigation and removed after

use ic_cdk::println;

/// Log distribution details for discrepancy investigation
/// Add this after line 966 in update.rs distribute_reward() function
pub fn log_distribution_discrepancy(
    lp_portion: u64,
    total_distributed: u128,
    total_staked: u64,
    alex_portion: u64,
    total_distribution: u64,
) {
    // Calculate theoretical vs actual
    let theoretical_total = lp_portion as u128;
    let actual_distributed = total_distributed;

    // This is the key metric - any difference here accumulates as surplus
    let rounding_loss = if theoretical_total > actual_distributed {
        theoretical_total - actual_distributed
    } else {
        0
    };

    // Log the findings
    println!("=== DISTRIBUTION DISCREPANCY DEBUG ===");
    println!("Total distribution: {} E8S", total_distribution);
    println!("ALEX portion (1%): {} E8S", alex_portion);
    println!("LP portion (99%): {} E8S", lp_portion);
    println!("Total staked: {} E8S", total_staked);
    println!("Theoretical to distribute: {} E8S", theoretical_total);
    println!("Actually distributed: {} E8S", actual_distributed);
    println!("ROUNDING LOSS: {} E8S", rounding_loss);
    println!("=====================================");

    // Also log if alex portion is correct
    let alex_expected = (total_distribution as f64 * 0.01) as u64;
    if alex_portion < alex_expected {
        println!("WARNING: ALEX underpaid by {} E8S", alex_expected - alex_portion);
    }
}

/// Log transfer fee accumulation for investigation
/// Call this whenever a transfer fee is involved
pub fn log_transfer_fee_event(
    operation: &str,
    amount: u64,
    fee_paid_by: &str,
    canister_balance_impact: i64,
) {
    println!("=== TRANSFER FEE EVENT ===");
    println!("Operation: {}", operation);
    println!("Amount: {} E8S", amount);
    println!("Fee paid by: {}", fee_paid_by);
    println!("Canister balance impact: {} E8S", canister_balance_impact);
    println!("==========================");
}

/// Log reconciliation details
pub fn log_reconciliation_details(
    actual_balance: u64,
    expected_balance: u64,
    discrepancy: i64,
    components: &str,
) {
    println!("=== RECONCILIATION DEBUG ===");
    println!("Actual balance: {} E8S", actual_balance);
    println!("Expected balance: {} E8S", expected_balance);
    println!("Discrepancy: {} E8S", discrepancy);
    println!("Components: {}", components);
    println!("============================");
}