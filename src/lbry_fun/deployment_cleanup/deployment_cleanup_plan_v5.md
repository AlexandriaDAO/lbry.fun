# Token Deployment - Admin Manual Intervention Approach

## Core Philosophy
- Deployment failures should be EXTREMELY rare
- When they do occur, they require human judgment
- No automatic cleanup that could make things worse
- Admin evaluates each situation and decides the appropriate action

## Implementation

### 1. Deployment Tracking
```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct FailedDeployment {
    pub timestamp: u64,
    pub caller: Principal,
    pub payment_amount: u64,
    pub created_canisters: Vec<Principal>,
    pub error_stage: String,
    pub error_details: String,
}

// Store failed deployments for admin review
thread_local! {
    static FAILED_DEPLOYMENTS: RefCell<Vec<FailedDeployment>> = RefCell::new(Vec::new());
}
```

### 2. Modified create_token Function
```rust
#[update]
async fn create_token(params: CreateTokenParams) -> Result<String, String> {
    let caller = ic_cdk::caller();
    let mut created_canisters: Vec<Principal> = vec![];
    
    // Collect payment
    deposit_icp_in_canister(500_000_000, None).await?;
    
    match deploy_token_complete(&mut created_canisters, params).await {
        Ok(token_id) => {
            Ok(format!("Token {} created successfully!", token_id))
        }
        Err(e) => {
            // Log the failure for admin review
            let failed = FailedDeployment {
                timestamp: ic_cdk::api::time(),
                caller,
                payment_amount: 500_000_000,
                created_canisters,
                error_stage: detect_error_stage(&e),
                error_details: e.clone(),
            };
            
            FAILED_DEPLOYMENTS.with(|f| f.borrow_mut().push(failed));
            
            Err(format!(
                "Deployment failed: {}. Your deployment has been logged for admin review. Reference ID: {}",
                e,
                ic_cdk::api::time()
            ))
        }
    }
}
```

### 3. Admin Query Functions
```rust
#[query(guard = "is_admin")]
fn get_failed_deployments() -> Vec<FailedDeployment> {
    FAILED_DEPLOYMENTS.with(|f| f.borrow().clone())
}

#[query(guard = "is_admin")]
fn analyze_failed_deployment(timestamp: u64) -> Result<DeploymentAnalysis, String> {
    // Provide detailed analysis of what went wrong
    // Check canister states
    // Estimate cleanup complexity
    // Suggest recommended action
}
```

### 4. Admin Action Functions
```rust
#[update(guard = "is_admin")]
async fn handle_failed_deployment(
    timestamp: u64,
    action: AdminAction
) -> Result<String, String> {
    let failed = get_failed_deployment_by_timestamp(timestamp)?;
    
    match action {
        AdminAction::DeleteAndRefund => {
            // Try to delete canisters
            for canister in failed.created_canisters {
                let _ = delete_canister(canister).await; // Best effort
            }
            // Refund user
            transfer_icp(failed.caller, 490_000_000).await?;
            Ok("Cleaned up and refunded")
        }
        
        AdminAction::CompleteManually { pool_id } => {
            // Admin manually created pool on KongSwap
            // Now create the token record
            create_token_record_from_failed(failed, pool_id)?;
            Ok("Deployment completed manually")
        }
        
        AdminAction::RefundOnly => {
            // Leave canisters, just refund
            transfer_icp(failed.caller, 490_000_000).await?;
            Ok("Refunded, canisters remain for investigation")
        }
        
        AdminAction::FixAndRetry => {
            // Admin fixed the issue (e.g., updated KongSwap integration)
            // Retry the deployment from where it failed
            retry_from_failure_point(failed).await
        }
    }
}
```

### 5. Monitoring and Alerts
```rust
#[heartbeat]
fn check_failed_deployments() {
    FAILED_DEPLOYMENTS.with(|f| {
        let failed = f.borrow();
        if !failed.is_empty() {
            ic_cdk::println!("ALERT: {} failed deployments pending review", failed.len());
        }
    });
}
```

## Benefits of This Approach

1. **Honest**: Acknowledges that some failures need human judgment
2. **Flexible**: Admin can choose the best action for each situation
3. **Safe**: No automatic actions that could make things worse
4. **Learnable**: Each failure helps improve the system
5. **Accountable**: Clear audit trail of what happened and why

## Admin Decision Tree

When a deployment fails, admin should:

1. **Analyze the failure**
   - What stage failed?
   - Is it a transient issue (KongSwap down) or permanent (bad parameters)?
   - Are the created resources salvageable?

2. **Decide on action**
   - If early failure with few resources → Delete and refund
   - If KongSwap issue → Fix integration and retry
   - If nearly complete → Manually complete the deployment
   - If unclear → Refund user but keep resources for investigation

3. **Learn and improve**
   - Update code to prevent similar failures
   - Add better error handling
   - Improve pre-flight checks

## Example Scenarios

### Scenario 1: KongSwap API Changed
- Admin sees pool creation failures
- Updates KongSwap integration code
- Uses `FixAndRetry` for pending deployments

### Scenario 2: Out of Cycles Mid-Deployment  
- Admin analyzes which canisters were created
- Manually completes deployment with additional cycles
- Updates cycle allocation for future deployments

### Scenario 3: Bad WASM Upload
- Admin sees consistent WASM installation failures
- Deletes partial canisters and refunds users
- Fixes WASM issue before allowing new deployments

## Implementation Priority

1. Add failed deployment tracking (simple list)
2. Add admin query functions
3. Add basic admin actions (delete & refund)
4. Add monitoring alerts
5. Iterate on advanced actions based on real failures

This approach is honest about the complexities of distributed systems and gives admins the tools to handle edge cases properly.