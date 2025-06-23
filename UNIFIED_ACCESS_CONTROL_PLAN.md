# Unified Access Control Plan for Swap Pages

## Overview
Create a single, elegant system that handles both authentication and trading availability states, providing a consistent and visually appealing experience across all swap page components.

## Problem Statement
Currently we have two separate issues:
1. **Unauthenticated users** can see swap pages but can't perform actions
2. **Authenticated users** can't trade tokens during the 24-hour launch period

Both cases need to:
- Show informational content (rates, stats, charts)
- Block trading actions with clear messaging
- Provide appropriate calls-to-action

## Proposed Solution: Access State System

### 1. Define Access States
```typescript
enum AccessState {
  FULL_ACCESS = 'full_access',           // Authenticated + token is live
  AWAITING_LAUNCH = 'awaiting_launch',   // Authenticated + token not live yet
  UNAUTHENTICATED = 'unauthenticated',   // Not logged in
  LOADING = 'loading'                    // Checking auth/token status
}

interface AccessContext {
  state: AccessState;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  countdown?: number; // seconds remaining for AWAITING_LAUNCH
}
```

### 2. Create Unified Access Guard Component
**Location**: `/src/lbry_fun_frontend/src/features/swap/components/AccessGuard.tsx`

```typescript
interface AccessGuardProps {
  children: React.ReactNode;
  accessState: AccessState;
  countdown?: number;
  onAuthenticate?: () => void;
}
```

**Visual Design**:
- **Full Access**: Renders children normally
- **Restricted Access**: Shows an elegant overlay with:
  - Blurred/dimmed background showing the actual interface
  - Centered card with state-specific messaging
  - Appropriate icon (lock for auth, clock for launch)
  - Clear call-to-action button

### 3. Create Access-Aware Component Wrapper
**Location**: `/src/lbry_fun_frontend/src/features/swap/components/SwapPageWrapper.tsx`

This wrapper will:
1. Check authentication status
2. Check if token is live (if authenticated)
3. Determine the appropriate `AccessState`
4. Wrap all swap page content with `AccessGuard`

### 4. Visual Design System

#### A. Color Coding
```scss
// Access state colors
$full-access: #10b981;      // Green - ready to trade
$awaiting-launch: #f59e0b;  // Amber - waiting period
$unauthenticated: #6366f1;  // Indigo - need to connect
```

#### B. Overlay States

**Unauthenticated State**:
```
┌─────────────────────────────────────┐
│      [Blurred Trading Interface]     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     🔒 Connect to Trade     │   │
│  │                             │   │
│  │  View live rates and stats  │   │
│  │  while exploring [TOKEN]    │   │
│  │                             │   │
│  │  [Connect Wallet] →         │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Awaiting Launch State**:
```
┌─────────────────────────────────────┐
│      [Blurred Trading Interface]     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ⏰ Launching Soon!       │   │
│  │                             │   │
│  │    23:47:32 remaining       │   │
│  │                             │   │
│  │  Trading starts at          │   │
│  │  Dec 24, 2024 15:30 UTC    │   │
│  │                             │   │
│  │  [Set Reminder] [Dismiss]   │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

#### C. Progressive Information Display

**Level 1 - Always Visible** (even unauthenticated):
- Token name, symbol, logos
- Current exchange rate
- Price charts
- Basic tokenomics info
- Total supply metrics

**Level 2 - Authenticated Only**:
- Your wallet balances
- Liquidity pool stats
- APY/staking information
- Your transaction history

**Level 3 - Live Trading Only**:
- Swap inputs and buttons
- Burn functionality
- Slippage settings
- Transaction execution

### 5. Component Integration Strategy

#### A. SwapWidget & BurnWidget
```typescript
// Simplified integration
<AccessGuard accessState={accessState} countdown={countdown}>
  <div className="space-y-4">
    {/* Always visible */}
    <TokenPriceDisplay />
    <ExchangeRateCard />
    
    {/* Conditionally interactive */}
    <SwapControls disabled={accessState !== AccessState.FULL_ACCESS} />
  </div>
</AccessGuard>
```

#### B. Smart Tooltips
When controls are disabled, show contextual tooltips:
- Unauthenticated: "Connect wallet to enable trading"
- Awaiting launch: "Trading starts in [countdown]"

### 6. State Management

Create a custom hook for access state:
```typescript
// useAccessState.ts
export function useAccessState(tokenId: string) {
  const { isAuthenticated } = useAuth();
  const { isLive, createdTime } = useTokenStatus(tokenId);
  
  const accessState = useMemo(() => {
    if (!isAuthenticated) return AccessState.UNAUTHENTICATED;
    if (!isLive) return AccessState.AWAITING_LAUNCH;
    return AccessState.FULL_ACCESS;
  }, [isAuthenticated, isLive]);
  
  return { accessState, countdown, ... };
}
```

### 7. Enhanced Features

#### A. Smart Notifications
- **For unauthenticated**: "Sign in to set launch reminders"
- **For authenticated**: "Get notified when trading goes live"

#### B. Educational Overlays
While waiting/unauthenticated, show:
- How the bonding curve works
- Tokenomics explanation
- What happens at launch
- Benefits of early participation

#### C. Social Proof
Display live stats even when trading is disabled:
- "147 users watching this token"
- "Expected launch liquidity: $50,000"
- "12 users have set reminders"

### 8. Implementation Priority

**Phase 1 - Core System**:
1. Create `AccessState` types and utilities
2. Build `AccessGuard` component
3. Implement `useAccessState` hook
4. Update `SwapWidget` and `BurnWidget`

**Phase 2 - Polish**:
1. Add animations and transitions
2. Implement reminder system
3. Add educational content
4. Create mobile-optimized layouts

**Phase 3 - Enhancements**:
1. WebSocket updates for countdown
2. Push notifications for launch
3. Social features (watching, sharing)
4. Analytics integration

### 9. Benefits of Unified Approach

1. **Code Reusability**: One system handles both auth and launch states
2. **Consistent UX**: Users see similar patterns for all restricted states
3. **Progressive Disclosure**: Show more as users get closer to trading
4. **Reduced Complexity**: Single source of truth for access control
5. **Better Onboarding**: Clear path from browsing → authenticating → trading

### 10. Testing Scenarios

- [ ] Unauthenticated user can see all public information
- [ ] Authenticated user sees countdown for non-live tokens
- [ ] Countdown updates in real-time
- [ ] State transitions smoothly when token goes live
- [ ] Mobile responsive design works for all states
- [ ] Accessibility: Screen readers properly announce states
- [ ] Performance: No lag when switching states

## Alternative Approach: Side-by-Side View

Instead of overlays, consider a side-by-side approach:
```
┌─────────────┬─────────────┐
│   INFO      │   TRADING   │
│  (Always    │  (Locked    │
│  Visible)   │   Until     │
│             │   Ready)    │
└─────────────┴─────────────┘
```

This keeps information always accessible while clearly showing what's available vs. restricted.

## Next Steps

1. Review and refine this unified approach
2. Create design mockups for each state
3. Build core components
4. Test with real users in both states
5. Iterate based on feedback