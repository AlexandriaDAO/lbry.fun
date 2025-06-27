# Distribution Tracking System - Implementation Plan

## Executive Summary

This document outlines the implementation of a comprehensive distribution tracking system for the LBRY Fun platform. The system will provide complete transparency into how ICP rewards are distributed across three pools: Alexandria (1%), LP Treasury (49.5%), and Stakers (49.5%).

## Problem Statement

Currently, users have no visibility into:
- How much ICP has been distributed to each pool
- Historical distribution patterns
- Current pool balances
- Distribution success/failure rates
- Where their staking rewards come from

This lack of transparency makes it difficult for users to understand the tokenomics and trust the system.

## Solution Overview

Implement an event-sourcing based tracking system that:
1. Records every distribution event immutably in the icp_swap canister
2. Exposes this data via query methods
3. Allows the logs canister to aggregate historical data
4. Provides a user-friendly display in the Analytics & Info tab

## Architectural Design

### 1. Event Sourcing in ICP_Swap Canister

**File**: `src/icp_swap/src/storage.rs`

Add new types and storage:

```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DistributionEvent {
    pub event_id: u64,
    pub timestamp: u64,
    pub distribution_cycle: u32,
    pub total_available: u64,
    pub allocations: DistributionAllocations,
    pub results: DistributionResults,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DistributionAllocations {
    pub alexandria_allocated: u64,      // Always 1% of distribution
    pub lp_treasury_allocated: u64,     // Always 49.5% of distribution
    pub stakers_allocated: u64,         // Always 49.5% of distribution
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DistributionResults {
    pub alexandria_sent: Option<u64>,           // None if transfer failed
    pub lp_treasury_added: u64,                 // Always succeeds (internal counter)
    pub stakers_distributed: Option<u64>,       // None if no stakers
    pub stakers_rollover: u64,                  // Amount that rolls to next cycle
    pub lp_provision_status: LpProvisionStatus, // Status of async LP provision
    pub error_details: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum LpProvisionStatus {
    Pending,                    // Not yet attempted
    Success { lp_tokens: Nat }, // Successfully added liquidity
    Failed { reason: String },  // Failed to add liquidity
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DistributionSummary {
    pub total_cycles: u32,
    pub total_alexandria_sent: u64,
    pub total_lp_treasury_balance: u64,
    pub total_stakers_distributed: u64,
    pub current_lp_provision_queue: u64,  // Accumulated primary tokens
    pub last_distribution: Option<DistributionEvent>,
    pub lifetime_totals: LifetimeDistributionTotals,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct LifetimeDistributionTotals {
    pub total_distributed: u64,
    pub alexandria_total: u64,
    pub lp_treasury_total: u64,
    pub stakers_total: u64,
}
```

Add stable storage:

```rust
thread_local! {
    // Map from event_id to DistributionEvent
    pub static DISTRIBUTION_EVENTS: RefCell<StableBTreeMap<u64, DistributionEvent, Memory>> = 
        RefCell::new(StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(15)))));
    
    // Counter for event IDs
    pub static NEXT_EVENT_ID: RefCell<Cell<u64, Memory>> = 
        RefCell::new(Cell::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(16))), 0).unwrap());
}
```

### 2. Update Distribution Logic

**File**: `src/icp_swap/src/update.rs`

Modify the `distribute_reward()` function to create and store events:

```rust
pub async fn distribute_reward() -> Result<String, ExecutionError> {
    // ... existing initialization code ...
    
    // Create event at start of distribution
    let mut event = DistributionEvent {
        event_id: get_next_event_id(),
        timestamp: ic_cdk::api::time(),
        distribution_cycle: get_distribution_interval(),
        total_available: total_icp_available,
        allocations: DistributionAllocations {
            alexandria_allocated: alexandria_fee_share as u64,
            lp_treasury_allocated: lp_treasury_share as u64,
            stakers_allocated: staker_share as u64,
        },
        results: DistributionResults {
            alexandria_sent: None,
            lp_treasury_added: 0,
            stakers_distributed: None,
            stakers_rollover: 0,
            lp_provision_status: LpProvisionStatus::Pending,
            error_details: None,
        },
    };
    
    // Update event.results as distribution progresses
    
    // Alexandria distribution
    if alexandria_fee_share > 0 {
        match send_icp(lbry_fun_principal, alexandria_fee_share as u64, None).await {
            Ok(_) => {
                event.results.alexandria_sent = Some(alexandria_fee_share as u64);
            },
            Err(e) => {
                // Log error but continue
                event.results.error_details = Some(format!("Alexandria: {}", e));
            }
        }
    }
    
    // LP Treasury (always succeeds)
    add_to_lp_treasury(lp_treasury_share as u64)?;
    event.results.lp_treasury_added = lp_treasury_share as u64;
    
    // Staker distribution
    if total_staked_primary == 0 {
        event.results.stakers_rollover = staker_share as u64;
        store_distribution_event(event);
        return Ok("Distribution complete (no stakers)");
    }
    
    // ... existing staker distribution logic ...
    event.results.stakers_distributed = Some(total_distributed_to_stakers);
    
    // Store event before triggering async LP provision
    store_distribution_event(event);
    
    // ... trigger LP provision ...
}
```

### 3. Query Methods

**File**: `src/icp_swap/src/query.rs`

Add new query methods:

```rust
#[query]
pub fn get_distribution_events(from_id: u64, limit: u32) -> Vec<DistributionEvent> {
    DISTRIBUTION_EVENTS.with(|events| {
        let events_map = events.borrow();
        let mut result = Vec::new();
        let limit = limit.min(100); // Cap at 100 events per query
        
        for i in 0..limit {
            let event_id = from_id + i as u64;
            if let Some(event) = events_map.get(&event_id) {
                result.push(event.clone());
            } else {
                break; // No more events
            }
        }
        
        result
    })
}

#[query]
pub fn get_distribution_summary() -> DistributionSummary {
    // Calculate totals from events
    let mut total_alexandria = 0u64;
    let mut total_stakers = 0u64;
    let mut last_event = None;
    
    DISTRIBUTION_EVENTS.with(|events| {
        let events_map = events.borrow();
        for (_, event) in events_map.iter() {
            if let Some(sent) = event.results.alexandria_sent {
                total_alexandria += sent;
            }
            if let Some(distributed) = event.results.stakers_distributed {
                total_stakers += distributed;
            }
            last_event = Some(event.clone());
        }
    });
    
    let total_lp_treasury = LP_TREASURY.with(|cell| *cell.borrow().get());
    let total_distributed = total_alexandria + total_lp_treasury + total_stakers;
    
    DistributionSummary {
        total_cycles: get_distribution_interval(),
        total_alexandria_sent: total_alexandria,
        total_lp_treasury_balance: total_lp_treasury,
        total_stakers_distributed: total_stakers,
        current_lp_provision_queue: get_accumulated_primary_tokens(),
        last_distribution: last_event,
        lifetime_totals: LifetimeDistributionTotals {
            total_distributed,
            alexandria_total: total_alexandria,
            lp_treasury_total: total_lp_treasury,
            stakers_total: total_stakers,
        },
    }
}

#[query]
pub fn get_latest_distribution_event() -> Option<DistributionEvent> {
    let current_id = NEXT_EVENT_ID.with(|id| *id.borrow().get());
    if current_id > 0 {
        DISTRIBUTION_EVENTS.with(|events| {
            events.borrow().get(&(current_id - 1)).cloned()
        })
    } else {
        None
    }
}
```

### 4. Update LP Provision Tracking

**File**: `src/icp_swap/src/update.rs`

Add a method to update LP provision status:

```rust
async fn update_lp_provision_status(event_id: u64, status: LpProvisionStatus) {
    DISTRIBUTION_EVENTS.with(|events| {
        let mut events_map = events.borrow_mut();
        if let Some(mut event) = events_map.get(&event_id).cloned() {
            event.results.lp_provision_status = status;
            events_map.insert(event_id, event);
        }
    });
}

// In provide_liquidity_from_treasury(), track the result:
async fn provide_liquidity_from_treasury() {
    // Get the latest event ID to update
    let latest_event_id = NEXT_EVENT_ID.with(|id| *id.borrow().get()).saturating_sub(1);
    
    // ... existing logic ...
    
    match add_liquidity_to_kong(...).await {
        Ok(result) => {
            update_lp_provision_status(
                latest_event_id, 
                LpProvisionStatus::Success { lp_tokens: result.add_lp_token_amount }
            ).await;
        },
        Err(e) => {
            update_lp_provision_status(
                latest_event_id,
                LpProvisionStatus::Failed { reason: e.to_string() }
            ).await;
        }
    }
}
```

### 5. Logs Canister Integration

**File**: `src/logs/src/lib.rs`

Add new types and storage for aggregated data:

```rust
#[derive(CandidType, Deserialize, Clone)]
pub struct HourlyDistributionData {
    pub timestamp: u64,
    pub hour: u32,
    pub events: Vec<DistributionEvent>,
    pub totals: DistributionTotals,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct DistributionTotals {
    pub alexandria: u64,
    pub lp_treasury: u64,
    pub stakers: u64,
    pub success_rate: f64,
}

// Add to periodic update function
async fn update_distribution_analytics(icp_swap_id: Principal) {
    // Get last processed event ID
    let last_processed = get_last_processed_event_id();
    
    // Query new events
    let new_events: Vec<DistributionEvent> = 
        call(icp_swap_id, "get_distribution_events", (last_processed + 1, 100)).await?;
    
    // Process and store events
    for event in new_events {
        store_distribution_event(event);
        update_last_processed_event_id(event.event_id);
    }
}
```

### 6. Frontend Integration

**File**: `src/lbry_fun_frontend/src/features/swap/components/terminals/AnalyticsTerminal.tsx`

Add a new section in the [insights] tab:

```typescript
interface DistributionData {
  summary: DistributionSummary;
  recentEvents: DistributionEvent[];
  hourlyData: HourlyDistributionData[];
}

const DistributionInsights: React.FC = () => {
  const { summary, recentEvents, hourlyData } = useDistributionData();
  
  return (
    <div className="terminal-section">
      <h3 className="terminal-header">
        <span className="terminal-prompt">&gt;</span> DISTRIBUTION ANALYTICS
      </h3>
      
      {/* Current Balances */}
      <div className="terminal-info">
        <div className="terminal-row">
          <span className="terminal-label">Alexandria Fund (1%):</span>
          <span className="terminal-value">{formatICP(summary.total_alexandria_sent)}</span>
        </div>
        <div className="terminal-row">
          <span className="terminal-label">LP Treasury (49.5%):</span>
          <span className="terminal-value">{formatICP(summary.total_lp_treasury_balance)}</span>
        </div>
        <div className="terminal-row">
          <span className="terminal-label">Stakers Pool (49.5%):</span>
          <span className="terminal-value">{formatICP(summary.total_stakers_distributed)}</span>
        </div>
      </div>
      
      {/* Distribution Chart */}
      <DistributionPieChart data={summary.lifetime_totals} />
      
      {/* Recent Events */}
      <div className="terminal-section mt-4">
        <h4>Recent Distributions</h4>
        {recentEvents.map(event => (
          <DistributionEventCard key={event.event_id} event={event} />
        ))}
      </div>
    </div>
  );
};
```

## Implementation Steps

1. **Phase 1: Backend Event Storage**
   - Add event types to storage.rs
   - Update distribute_reward to create events
   - Implement query methods
   - Test with unit tests

2. **Phase 2: Logs Canister Integration**
   - Add distribution data types
   - Implement event pulling logic
   - Add aggregation functions
   - Test data flow

3. **Phase 3: Frontend Display**
   - Create React hooks for data fetching
   - Build UI components
   - Add to Analytics terminal
   - Test user experience

## Benefits

1. **Complete Transparency**: Users can see exactly where every ICP goes
2. **Trust Building**: Verifiable on-chain data
3. **Debugging**: Easy to diagnose distribution issues
4. **Analytics**: Historical trends and patterns
5. **Future-Proof**: Event sourcing allows reconstructing any state

## Testing Strategy

1. **Unit Tests**: Test event creation and storage
2. **Integration Tests**: Test cross-canister queries
3. **UI Tests**: Verify data display accuracy
4. **Load Tests**: Ensure performance with many events

## Migration Considerations

- The system is backward compatible
- Existing distributions won't have events (show as "pre-tracking era")
- No changes to core distribution logic required
- Can be deployed incrementally

## Security Considerations

- All data is read-only from frontend
- No sensitive information exposed
- Events are immutable once written
- Query methods have appropriate guards

This design ensures complete transparency while maintaining simplicity and robustness in the core distribution system.