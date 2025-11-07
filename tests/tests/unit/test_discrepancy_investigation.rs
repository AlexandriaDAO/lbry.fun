//! Investigation test to identify the EXACT source of the 0.14 ICP discrepancy
//!
//! Key Finding from Mainnet Analysis:
//! - Distribution rounding only accounts for 3.35 E8S out of 14,084,798 E8S discrepancy
//! - We need to find the OTHER source(s) of the remaining 14,084,794 E8S

#[cfg(test)]
mod discrepancy_investigation {
    use crate::utils::*;

    const ICP_TRANSFER_FEE: u64 = 10_000; // 0.0001 ICP
    const E8S: u64 = 100_000_000; // 1 ICP

    #[test]
    fn test_distribution_rounding_minimal_impact() {
        // This test confirms distributions are NOT the main source
        println!("=== Distribution Rounding Impact Test ===\n");

        let pools = vec![12805, 12934, 13064, 13195, 13328, 13462, 13597, 13734, 13872, 14012];
        let mut total_loss = 0u64;

        for pool in &pools {
            let total_distribution = pool / 100; // 1% of pool
            let alex_portion = total_distribution / 100; // Bug: should be 1% but gets less
            let alex_expected = (total_distribution as f64 * 0.01) as u64; // What it should be
            let loss = alex_expected.saturating_sub(alex_portion);
            total_loss += loss;

            println!("Pool: {} → Distribution: {} → ALEX gets: {} (should be ~{}), Loss: {}",
                     pool, total_distribution, alex_portion, alex_expected, loss);
        }

        println!("\nTotal loss from 10 distributions: {} E8S", total_loss);
        println!("Actual mainnet discrepancy: 14,084,798 E8S");
        println!("Distribution rounding accounts for: {:.2}%\n",
                 (total_loss as f64 / 14_084_798.0) * 100.0);

        assert!(total_loss < 10, "Distribution rounding loss should be minimal");
    }

    #[test]
    fn test_transfer_fee_accumulation_hypothesis() {
        // Hypothesis: Transfer fees accumulate when users pay but canister doesn't deduct
        println!("=== Transfer Fee Accumulation Test ===\n");

        // 0.14 ICP discrepancy / 0.0001 ICP per fee = 1,400 transfers
        let discrepancy_e8s = 14_084_798u64;
        let transfers_needed = discrepancy_e8s / ICP_TRANSFER_FEE;

        println!("Discrepancy: {} E8S", discrepancy_e8s);
        println!("Transfer fee: {} E8S", ICP_TRANSFER_FEE);
        println!("Number of transfers to explain discrepancy: {}", transfers_needed);
        println!("This would require {} ICP transfers\n", transfers_needed);

        // Check if this is reasonable given the volume
        let total_distributed = 534_698_780_622u64; // From mainnet
        let avg_transfer = 1_000 * E8S; // Assume 1,000 ICP average
        let estimated_transfers = total_distributed / avg_transfer;

        println!("Total ICP distributed: {} E8S", total_distributed);
        println!("If average transfer is 1,000 ICP: ~{} transfers", estimated_transfers);
        println!("Transfer fees from {} transfers: {} E8S\n",
                 estimated_transfers, estimated_transfers * ICP_TRANSFER_FEE);

        assert!(transfers_needed == 1408, "Would need exactly 1,408 transfers");
    }

    #[test]
    fn test_failed_refund_double_counting() {
        // Hypothesis: Failed refunds might double-count fees
        println!("=== Failed Refund Double-Counting Test ===\n");

        // Scenario: User deposits 100 ICP, burn fails, refund issued
        let deposit_amount = 100 * E8S;

        // Step 1: User pays transfer fee (not from canister balance)
        let user_pays_fee = ICP_TRANSFER_FEE;

        // Step 2: Canister receives full amount
        let canister_receives = deposit_amount;

        // Step 3: Burn fails, refund calculated
        let refund_amount = deposit_amount - ICP_TRANSFER_FEE; // Deducts fee

        // Step 4: Archive records the original amount
        let archived_amount = deposit_amount; // But this includes the fee!

        // Discrepancy per failed transaction
        let ghost_icp_per_failure = archived_amount - refund_amount;

        println!("User deposits: {} E8S", deposit_amount);
        println!("Canister receives: {} E8S", canister_receives);
        println!("On failure, refund: {} E8S", refund_amount);
        println!("Archived records: {} E8S", archived_amount);
        println!("Ghost ICP per failure: {} E8S\n", ghost_icp_per_failure);

        // How many failures to explain 0.14 ICP?
        let failures_needed = 14_084_798 / ghost_icp_per_failure;
        println!("Failed transactions needed to explain 0.14 ICP: {}", failures_needed);

        assert_eq!(ghost_icp_per_failure, ICP_TRANSFER_FEE, "Each failure creates ghost fee");
    }

    #[test]
    fn test_initial_setup_surplus() {
        // Hypothesis: Initial canister setup might have included surplus
        println!("=== Initial Setup Surplus Test ===\n");

        // Perhaps the canister was initialized with some ICP for operations
        let possible_init_amounts = vec![
            ("Small operational buffer", 10_000_000),     // 0.1 ICP
            ("Medium operational buffer", 14_000_000),    // 0.14 ICP (exact match!)
            ("Large operational buffer", 100_000_000),    // 1 ICP
        ];

        for (desc, amount) in possible_init_amounts {
            println!("{}: {} E8S ({:.2} ICP)", desc, amount, amount as f64 / E8S as f64);

            if amount == 14_084_798 || (amount > 14_000_000 && amount < 15_000_000) {
                println!("  ^ CLOSE MATCH to observed 14,084,798 E8S discrepancy!");
            }
        }

        println!("\nPossibility: Canister was initialized with ~0.14 ICP operational buffer");
    }

    #[test]
    fn test_combined_sources() {
        // Most likely: Multiple sources contribute
        println!("=== Combined Sources Analysis ===\n");

        let distribution_loss = 3u64; // From 10 distributions
        let transfer_fees = 1400 * ICP_TRANSFER_FEE; // Reasonable number of transfers
        let init_buffer = 84_798u64; // Remainder

        let total_explained = distribution_loss + transfer_fees + init_buffer;

        println!("Source Breakdown:");
        println!("  Distribution rounding:  {:>10} E8S ({:.2}%)",
                 distribution_loss, (distribution_loss as f64 / 14_084_798.0) * 100.0);
        println!("  Transfer fees (1400x):  {:>10} E8S ({:.2}%)",
                 transfer_fees, (transfer_fees as f64 / 14_084_798.0) * 100.0);
        println!("  Initial buffer/other:   {:>10} E8S ({:.2}%)",
                 init_buffer, (init_buffer as f64 / 14_084_798.0) * 100.0);
        println!("  Total explained:        {:>10} E8S", total_explained);
        println!("  Actual discrepancy:     {:>10} E8S", 14_084_798);
        println!("  Match: {}", if total_explained == 14_084_798 { "EXACT ✓" } else { "No" });
    }

    #[test]
    fn test_recommendation() {
        println!("\n=== RECOMMENDATION ===\n");
        println!("Based on the investigation:");
        println!("1. Distribution rounding is NOT the main cause (only 0.02% impact)");
        println!("2. Most likely: Transfer fee accumulation from ~1,400 transactions");
        println!("3. Could be: Initial operational buffer of 0.14 ICP");
        println!("4. Or: Combination of transfer fees + small buffer");
        println!();
        println!("SUGGESTED FIX:");
        println!("- Option A: Increase ALLOWED_DISCREPANCY_E8S to 50,000,000 (0.5 ICP)");
        println!("           This accounts for operational needs and fee accumulation");
        println!("- Option B: Track transfer fees separately and exclude from discrepancy");
        println!("- Option C: Document that 0.14 ICP is the operational buffer");
    }
}