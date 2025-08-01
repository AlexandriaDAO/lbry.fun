# Deployment System Issues

## Overview
This document describes the current issues with the deployment system, particularly around deployment state management and the interaction between frontend and backend.

## Core Issues

### 1. Deployment Records Never Expire
**Problem**: The backend's `get_my_deployments()` returns ALL deployments ever created by a user, including:
- Failed deployments that have been cleaned up
- Old deployments from months ago
- Deployments in "Cleaning" state that have already been refunded

**Impact**: 
- Frontend UI becomes cluttered with historical deployments
- Users cannot permanently remove failed/old deployments from their view
- "Remove from List" in frontend is ineffective as deployments reappear on refresh

### 2. Two-Phase Deployment Creates Stuck States
**Current Flow**:
1. Phase 1: `initiate_token_deployment()` - Creates deployment record, takes payment
2. Phase 2: `execute_token_deployment()` - Actually creates the canisters

**Problem**: If Phase 2 is never called (e.g., user closes browser, network failure), deployment remains in "Active" state forever with 0% progress.

**Impact**:
- Users see deployments stuck at "Creating swap mechanism... 0%"
- Backend blocks new deployments with error: "You have an active deployment (ID: X)"
- Users must manually recover or complete these stuck deployments

### 3. Inconsistent Status Representation
**Backend Status Values** (from DeploymentStatus enum):
- `Active` - Deployment in progress
- `Failed` - Marked for cleanup
- `Cleaning` - Cleanup in progress  
- `Completed` - Successfully deployed

**Frontend Conversion Issues**:
- Backend returns status as `format!("{:?}", d.status)` (capitalized strings)
- Frontend was checking for lowercase values ('active', 'failed')
- Missing handling for "Cleaning" status
- No clear mapping between deployment status and token status

### 4. Lost Deployment Context
**Problem**: When fetching deployments from `get_my_deployments()`, the frontend loses:
- Original token creation parameters (stored during Phase 1)
- User's intended action (were they creating a new token or recovering?)
- Whether the deployment can actually be recovered

**Current Workaround**: Frontend tries to persist deployment params in localStorage, but this is fragile and can be lost.

### 5. Recovery Mechanism Confusion
**Current Behavior**:
- `recover_stuck_deployment()` works globally - affects any stuck deployment
- No way to recover a specific deployment by ID
- Recovery only available after 5 minutes of inactivity
- Users can't tell which deployments are recoverable without trying

## Example User Flows Demonstrating Issues

### Flow 1: Stuck Deployment
1. User initiates deployment (pays 5 ICP)
2. Browser crashes before Phase 2
3. User returns to see deployment at 0%
4. User tries to create new token
5. Gets error: "You have an active deployment"
6. Must figure out how to recover or continue

### Flow 2: Cluttered History
1. User has created 10 tokens over 6 months
2. 3 failed, 2 succeeded, 5 in various states
3. Opens "My Deployments" page
4. Sees all 10 deployments every time
5. Clicks "Remove from List" on old ones
6. They reappear on page refresh

### Flow 3: Unknown Status
1. User has deployment that failed and was cleaned
2. Deployment shows "Unknown deployment state"
3. No indication of what happened or why
4. Can't recover (already cleaned) but doesn't know that

## Current Data Flow

```
Backend (get_my_deployments) 
    ↓
Returns: Vec<DeploymentInfo> {
    id, 
    status: String (e.g. "Active", "Failed"), 
    token_id: Option<u64>,
    last_error: Option<String>,
    ...
}
    ↓
Frontend converts to TokenStatus
    ↓
Problems:
- If no token_id and status is ambiguous → "Unknown state"
- Historical deployments included
- No way to hide/archive deployments
- Status string matching is fragile
```

## Summary of Pain Points

1. **No deployment lifecycle management** - Deployments exist forever in backend
2. **Two-phase process creates edge cases** - Easy to get stuck between phases
3. **Frontend forced to manage backend's data** - Must filter/hide deployments locally
4. **Poor visibility into deployment state** - Users don't understand what's happening
5. **Global recovery vs specific recovery** - Can't target specific deployments
6. **No deployment history filtering** - Active vs completed vs failed all mixed together