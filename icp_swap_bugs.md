 Comprehensive Fix Plan for ICP Swap Canister Critical Bugs

  Bug 1: Double Archive Amount on Failed ICP Refund

  Problem Description

  When a user burns secondary tokens to receive a 50% ICP refund, if the ICP transfer fails, the
  canister incorrectly archives double the refund amount for later redemption. This allows users to
   claim 100% of their original ICP instead of the 50% they deserve.

  Context

  The burn_secondary function implements a token burning mechanism where:
  1. Users burn secondary tokens (originally minted with ICP at $0.01 rate)
  2. Users receive 50% of the original ICP back as a refund
  3. The other 50% stays in the pool for stakers
  4. Users also receive primary tokens as a reward

  Code Analysis

  Location: /home/theseus/alexandria/lbryfun/src/icp_swap/src/update.rs, lines 399-435

  Current problematic code:
  // After send_icp fails at line 377
  Err(e) => {
      // Lines 400-422: Incorrectly calculates archive amount
      let amount_icp_after_fee = amount_icp_e8s
          .checked_mul(2)  // BUG: Multiplies by 2, doubling the amount
          .ok_or_else(||
              ExecutionError::new_with_log(
                  caller,
                  "burn_secondary",
                  ExecutionError::MultiplicationOverflow {
                      operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
                      details: format!("amount_icp_e8s: {} with {}", amount_icp_e8s, 2),
                  }
              )
          )?
          .checked_sub(ICP_TRANSFER_FEE)
          .ok_or_else(||
              ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::Underflow {
                  operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                  details: format!(
                      "amount_icp_e8s: {} with ICP_TRANSFER_FEE: {}",
                      amount_icp_e8s,
                      ICP_TRANSFER_FEE
                  ),
              })
          )?;

      archive_user_transaction(amount_icp_after_fee)?;
      return Err(...);
  }

  The Fix

  Remove the multiplication by 2, archiving only the actual refund amount that failed to send:

  - let amount_icp_after_fee = amount_icp_e8s
  -     .checked_mul(2)
  -     .ok_or_else(||
  -         ExecutionError::new_with_log(
  -             caller,
  -             "burn_secondary",
  -             ExecutionError::MultiplicationOverflow {
  -                 operation: DEFAULT_MULTIPLICATION_OVERFLOW_ERROR.to_string(),
  -                 details: format!("amount_icp_e8s: {} with {}", amount_icp_e8s, 2),
  -             }
  -         )
  -     )?
  -     .checked_sub(ICP_TRANSFER_FEE)
  + let amount_icp_after_fee = amount_icp_e8s
  +     .checked_sub(ICP_TRANSFER_FEE)
        .ok_or_else(||
            ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::Underflow {
                operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                details: format!(
                    "amount_icp_e8s: {} with ICP_TRANSFER_FEE: {}",
                    amount_icp_e8s,
                    ICP_TRANSFER_FEE
                ),
            })
        )?;

  ---
  Bug 2: Double Payment on Failed Primary Mint

  Problem Description

  After successfully sending a 50% ICP refund to the user, if the subsequent primary token mint
  fails, the canister incorrectly archives additional ICP for the user to redeem. This results in
  the user receiving payment twice: once via the successful transfer and once via the archive
  mechanism.

  Context

  The burn_secondary flow has two main operations after burning secondary tokens:
  1. Send 50% ICP refund to the user
  2. Mint primary tokens as a reward

  If step 1 succeeds but step 2 fails, the current code incorrectly compensates the user again.

  Code Analysis

  Location: /home/theseus/alexandria/lbryfun/src/icp_swap/src/update.rs, lines 449-485

  Current problematic code:
  // After successful ICP refund at line 377
  match send_icp(caller, amount_icp_e8s, None).await {
      Ok(_) => {
          // ... successful refund logged ...

          // Line 449: Try to mint primary tokens
          match mint_primary(amount_secondary, caller, from_subaccount).await {
              Ok(_) => {
                  // Success case
              }
              Err(e) => {
                  // BUG: Archives ICP even though user already got refund
                  let amount_icp_after_fee = amount_icp_e8s
                      .checked_sub(ICP_TRANSFER_FEE)
                      .ok_or_else(||
                          ExecutionError::new_with_log(
                              caller,
                              "burn_secondary",
                              ExecutionError::Underflow {
                                  operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
                                  details: format!(
                                      "amount_icp_e8s: {} with ICP_TRANSFER_FEE: {}",
                                      amount_icp_e8s,
                                      ICP_TRANSFER_FEE
                                  ),
                              }
                          )
                      )?;

                  archive_user_transaction(amount_icp_after_fee)?;  // BUG: Double payment
                  return Err(
                      ExecutionError::new_with_log(caller, "burn_secondary",
  ExecutionError::MintFailed {
                          token: "primary".to_string(),
                          amount: amount_secondary,
                          details: e,
                          reason: DEFAULT_MINT_FAILED.to_string(),
                      })
                  );
              }
          }
      }
  }

  The Fix

  Remove the entire archive operation when mint_primary fails after a successful refund:

    match mint_primary(amount_secondary, caller, from_subaccount).await {
        Ok(_) => {
            register_info_log(
                caller,
                "burn_secondary",
                &format!("Burn completed successfully.Minted primary tokens to {}", caller)
            );
        }
        Err(e) => {
  -         let amount_icp_after_fee = amount_icp_e8s
  -             .checked_sub(ICP_TRANSFER_FEE)
  -             .ok_or_else(||
  -                 ExecutionError::new_with_log(
  -                     caller,
  -                     "burn_secondary",
  -                     ExecutionError::Underflow {
  -                         operation: DEFAULT_UNDERFLOW_ERROR.to_string(),
  -                         details: format!(
  -                             "amount_icp_e8s: {} with ICP_TRANSFER_FEE: {}",
  -                             amount_icp_e8s,
  -                             ICP_TRANSFER_FEE
  -                         ),
  -                     }
  -                 )
  -             )?;
  -
  -         archive_user_transaction(amount_icp_after_fee)?;
            return Err(
                ExecutionError::new_with_log(caller, "burn_secondary", ExecutionError::MintFailed {
                    token: "primary".to_string(),
                    amount: amount_secondary,
                    details: e,
                    reason: DEFAULT_MINT_FAILED.to_string(),
                })
            );
        }
    }

  ---
  Bug 3: Race Condition in Fee Collection

  Problem Description

  The collect_alex_fees function has a race condition where concurrent operations can cause fee
  updates to be lost. When a transfer fails, the function restores the original fee amount,
  potentially overwriting any fees added by concurrent operations (like distribute_reward).

  Context

  The canister collects 1% of distributions as fees for the parent project (ALEX stakers). These
  fees accumulate in UNCOLLECTED_ALEX_FEES and are periodically collected by the parent canister.
  The current implementation uses a non-atomic read-modify-write pattern that can lose updates.

  Code Analysis

  Location: /home/theseus/alexandria/lbryfun/src/icp_swap/src/update.rs, lines 1739-1768

  Current problematic code:
  #[update(guard = "only_lbry_fun")]
  pub async fn collect_alex_fees() -> Result<CollectionResult, CollectionError> {
      // Check
      let fees = UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));

      if fees < ICP_TRANSFER_FEE {
          return Err(CollectionError::AmountTooSmall { amount: fees });
      }

      // Effect - deduct from balance (sets to 0)
      UNCOLLECTED_ALEX_FEES.with(|f| {
          f.borrow_mut().insert((), 0);  // Zeroes out fees
      });

      // Interaction - external transfer
      match transfer_icp_to_lbry_fun(fees).await {
          Ok(_) => {
              Ok(CollectionResult {
                  collected: fees,
                  timestamp: ic_cdk::api::time()
              })
          }
          Err(e) => {
              // BUG: Restores original amount, losing any concurrent updates
              UNCOLLECTED_ALEX_FEES.with(|f| {
                  f.borrow_mut().insert((), fees);  // Overwrites with old value
              });
              Err(CollectionError::TransferFailed { reason: e.to_string() })
          }
      }
  }

  Race Condition Scenario:
  1. Time T0: UNCOLLECTED_ALEX_FEES = 100 ICP
  2. Time T1: collect_alex_fees() reads 100, sets to 0
  3. Time T2: distribute_reward() adds 10 ICP (should be 10 total)
  4. Time T3: transfer fails, collect_alex_fees() sets to 100 (loses the 10)

  The Fix

  Use atomic operations and add back the fees on failure instead of restoring the original:

    #[update(guard = "only_lbry_fun")]
    pub async fn collect_alex_fees() -> Result<CollectionResult, CollectionError> {
  -     // Check
  -     let fees = UNCOLLECTED_ALEX_FEES.with(|f| f.borrow().get(&()).unwrap_or(0));
  -     
  -     if fees < ICP_TRANSFER_FEE {
  -         return Err(CollectionError::AmountTooSmall { amount: fees });
  -     }
  -     
  -     // Effect - deduct from balance
  -     UNCOLLECTED_ALEX_FEES.with(|f| {
  -         f.borrow_mut().insert((), 0);
  +     // Atomic check and extraction
  +     let fees = UNCOLLECTED_ALEX_FEES.with(|f| {
  +         let current = f.borrow().get(&()).unwrap_or(0);
  +         if current >= ICP_TRANSFER_FEE {
  +             f.borrow_mut().insert((), 0);
  +             current
  +         } else {
  +             0
  +         }
        });

  +     if fees == 0 {
  +         return Err(CollectionError::AmountTooSmall { amount: 0 });
  +     }
  +     
        // Interaction - external transfer
        match transfer_icp_to_lbry_fun(fees).await {
            Ok(_) => {
                Ok(CollectionResult {
                    collected: fees,
                    timestamp: ic_cdk::api::time()
                })
            }
            Err(e) => {
  -             // Failure reversal - restore exact balance
  +             // Failure reversal - add back to current balance
                UNCOLLECTED_ALEX_FEES.with(|f| {
  -                 f.borrow_mut().insert((), fees);
  +                 let current = f.borrow().get(&()).unwrap_or(0);
  +                 f.borrow_mut().insert((), current + fees);
                });
                Err(CollectionError::TransferFailed { reason: e.to_string() })
            }
        }
    }

  ---
  Bug 4: Incomplete Balance Reconciliation in Monitoring Script

  Problem Description

  The check_balances.sh script fails to include archived balances (ICP held for users from failed 
  transactions) in its internal state calculation. This causes false discrepancy reports and masks 
  the true state of the canister's accounting, making it difficult to detect when actual balance 
  issues occur.

  Context

  The ICP Swap canister maintains four separate buckets of ICP:
  1. `total_unclaimed` - Staking rewards accumulated by users
  2. `reward_pool` - ICP collected but not yet distributed to stakers  
  3. `uncollected_fees` - Platform fees (1% of distributions) for parent project
  4. `archived_balance` - ICP from failed transactions awaiting user redemption

  The script currently only sums the first three, missing the archived balance entirely.

  Code Analysis

  Location: /home/theseus/alexandria/lbryfun/scripts/check_balances.sh, lines 70-87

  Current problematic code:
  # Get total unclaimed rewards from all users
  total_unclaimed=$(dfx canister call $ICP_SWAP get_total_unclaimed_icp_reward '()' 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
  if [ -z "$total_unclaimed" ]; then total_unclaimed=0; fi
  total_unclaimed_icp=$(echo "scale=8; $total_unclaimed / 100000000" | bc)

  echo -e "${MAGENTA}[STATE]${NC} Your Unclaimed:      ${GREEN}$(printf "%.8f" $your_reward_icp) ICP${NC}"
  echo -e "${MAGENTA}[STATE]${NC} All Unclaimed:       ${GREEN}$(printf "%.8f" $total_unclaimed_icp) ICP${NC}"
  echo -e "${MAGENTA}[STATE]${NC} Reward Pool:         ${GREEN}$(printf "%.8f" $reward_pool_icp) ICP${NC}"
  echo -e "${MAGENTA}[STATE]${NC} Uncollected Fees:    ${GREEN}$(printf "%.8f" $uncollected_fees_icp) ICP${NC}"
  echo ""

  # Internal total (calculate in E8S for precision)
  internal_total_e8s=$((total_unclaimed + reward_pool + uncollected_fees))  # BUG: Missing archived balance
  internal_total=$(echo "scale=8; $internal_total_e8s / 100000000" | bc)

  The Fix

  Add archived balance retrieval and include it in the internal total calculation:

    # Get total unclaimed rewards from all users
    total_unclaimed=$(dfx canister call $ICP_SWAP get_total_unclaimed_icp_reward '()' 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
    if [ -z "$total_unclaimed" ]; then total_unclaimed=0; fi
    total_unclaimed_icp=$(echo "scale=8; $total_unclaimed / 100000000" | bc)

  + # Get total archived balance (ICP from failed transactions awaiting redemption)
  + total_archived=$(dfx canister call $ICP_SWAP get_total_archived_balance '()' 2>/dev/null | grep -oE '[0-9_]+' | head -1 | tr -d '_')
  + if [ -z "$total_archived" ]; then total_archived=0; fi
  + total_archived_icp=$(echo "scale=8; $total_archived / 100000000" | bc)

    echo -e "${MAGENTA}[STATE]${NC} Your Unclaimed:      ${GREEN}$(printf "%.8f" $your_reward_icp) ICP${NC}"
    echo -e "${MAGENTA}[STATE]${NC} All Unclaimed:       ${GREEN}$(printf "%.8f" $total_unclaimed_icp) ICP${NC}"
  + echo -e "${MAGENTA}[STATE]${NC} Archived Balance:    ${GREEN}$(printf "%.8f" $total_archived_icp) ICP${NC}"
    echo -e "${MAGENTA}[STATE]${NC} Reward Pool:         ${GREEN}$(printf "%.8f" $reward_pool_icp) ICP${NC}"
    echo -e "${MAGENTA}[STATE]${NC} Uncollected Fees:    ${GREEN}$(printf "%.8f" $uncollected_fees_icp) ICP${NC}"
    echo ""

    # Internal total (calculate in E8S for precision)
  - internal_total_e8s=$((total_unclaimed + reward_pool + uncollected_fees))
  + internal_total_e8s=$((total_unclaimed + total_archived + reward_pool + uncollected_fees))
    internal_total=$(echo "scale=8; $internal_total_e8s / 100000000" | bc)

  Impact

  This fix ensures the monitoring script accurately reports the canister's internal state by:
  1. Including all four ICP buckets in the reconciliation
  2. Making discrepancies visible when they actually exist
  3. Providing visibility into archived balance accumulation

  ---
  Summary

  These four bugs create serious financial vulnerabilities and monitoring blind spots:

  1. Bug 1 allows users to claim 2x their deserved refund from archived transactions
  2. Bug 2 allows users to receive double payment (refund + archive)
  3. Bug 3 causes the canister to lose track of collected fees
  4. Bug 4 prevents accurate monitoring of the canister's true balance state

  All four fixes are surgical changes that don't require architectural redesign:
  - Bug 1: Remove the multiplication by 2 (1 line change)
  - Bug 2: Delete the archive block (17 lines removal)
  - Bug 3: Change to atomic operation with additive restoration
  - Bug 4: Add archived balance to script calculations (4 lines addition)

  These changes maintain all existing features while eliminating the vulnerabilities and providing accurate monitoring.
