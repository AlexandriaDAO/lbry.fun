# Simple Version Tracking Implementation

## Goal
Track which version of the codebase each token was launched with.

## Implementation (4 lines total)

### 1. Add Version Constant
**File: `/src/lbry_fun/src/constants.rs`**
```rust
pub const CODEBASE_VERSION: &str = "0.1.0";
```

### 2. Add Field to TokenRecord  
**File: `/src/lbry_fun/src/storage.rs`**
```rust
pub struct TokenRecord {
    // ... existing fields ...
    pub codebase_version: String,  // Add this line
}
```

### 3. Set Version When Creating Token
**File: `/src/lbry_fun/src/deployment_execution.rs`**
```rust
let mut token_record = TokenRecord {
    // ... existing fields ...
    codebase_version: CODEBASE_VERSION.to_string(),  // Add this line
};
```

### 4. Update Frontend Type
**File: `/src/lbry_fun_frontend/src/types/token.ts`**
```typescript
export interface TokenRecord {
    // ... existing fields ...
    codebase_version: string;  // Add this line
}
```

## That's it!

No need to:
- Pass version to child canisters
- Modify init args
- Change function signatures  
- Add complex storage mechanisms

If we ever need to know what version a token was created with, we just query the TokenRecord from lbry_fun canister.