# Deployment Fixed Cost Buffer Implementation Plan

## Overview
Implement a 1 ICP fixed cost buffer for token deployments to cover cycle costs and prevent abuse.

### Current State
- Users pay: 5 ICP
- Users receive on failure: 4.9999 ICP (minus 0.0001 ICP transfer fee)
- Platform keeps: 0.0001 ICP (only transfer fee)

### New State
- Users pay: 5 ICP
- Users receive on failure: 4 ICP
- Platform keeps: 1 ICP (covers all cycle costs + provides buffer against abuse)

## Implementation Changes

### 1. Backend Changes

#### File: `src/lbry_fun/src/deployment_cleanup.rs`

**Current code (2 locations):**
```rust
let refund_amount = deployment.payment_amount.saturating_sub(10_000);
```

**Change to:**
```rust
// Platform fee: 1 ICP (100_000_000 e8s) to cover cycle costs
const PLATFORM_FEE: u64 = 100_000_000; // 1 ICP
let refund_amount = deployment.payment_amount.saturating_sub(PLATFORM_FEE);
```

#### File: `src/lbry_fun/src/deployment_updates.rs`

**Update error message calculation (~line 422):**
```rust
Ok(format!(
    "Deployment {} marked for cleanup. Refund of {} ICP will be processed within 5 minutes.",
    deployment_id,
    (deployment.payment_amount - 100_000_000) as f64 / 100_000_000.0 // Now shows 4.0 ICP
))
```

### 2. Frontend Changes

#### File: `src/lbry_fun_frontend/src/features/token/components/terminal/TerminalCreateToken.tsx`

**Current code (~line 698):**
```typescript
<span className="ml-4 text-xs text-gray-400">
  (Refundable on failure: 4.9999 ICP)
</span>
```

**Change to:**
```typescript
<span className="ml-4 text-xs text-gray-400">
  (Refundable on failure: 4.0 ICP)
</span>
```

### 3. Documentation Updates

#### File: `frontend_recovery_plan_v2.md`

Update lines 596 and 1171 to reflect the new refund amount of 4.0 ICP.

## Benefits

1. **Covers all costs**: 1 ICP easily covers the ~0.003-0.006 ICP worth of cycles used
2. **Deters abuse**: Attackers lose 1 ICP per failed deployment attempt
3. **Simple and predictable**: Users know exactly what they'll get back
4. **Revenue positive**: Platform retains funds to cover operational costs

## Testing Plan

1. Deploy a token that fails (e.g., with KongSwap missing)
2. Verify refund amount is exactly 4.0 ICP
3. Check all error messages show correct refund amount
4. Confirm frontend displays correct refundable amount

## Future Considerations

If 1 ICP proves too high for legitimate users, we could:
- Reduce to 0.5 ICP buffer
- Implement tiered refunds based on failure stage
- Add success bonuses to offset the higher fee