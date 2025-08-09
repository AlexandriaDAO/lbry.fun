# Improved Distribution Interval Fix Plan

## Problem Statement
The frontend displays incorrect distribution intervals (e.g., "[EVERY 1 HOUR]") even when tokens are configured with different intervals. This causes confusion, incorrect APY calculations, and breaks test networks using shorter intervals.

## Root Cause Analysis

### Core Issue
The codebase has evolved with a 1-hour interval assumption baked into multiple layers:
1. **Validation Layer**: Actively rejects and overwrites non-standard intervals
2. **Utility Layer**: Functions hardcode interval values instead of accepting parameters
3. **Component Layer**: Components don't consistently use Redux state for intervals
4. **Display Layer**: UI strings hardcode time descriptions

### Impact Cascade
```
Incorrect Interval → Wrong APY → Bad Investment Decisions
                  ↘ Wrong Countdown → User Confusion
                  ↘ Test Networks Broken → Development Blocked
```

## Solution Architecture

### Design Principles
1. **Single Source of Truth**: Distribution interval from backend config
2. **Pure Utility Functions**: Accept interval as parameter, no hardcoding
3. **Consistent State Usage**: All components read from Redux state
4. **No Arbitrary Validation**: Trust backend-provided values

### Data Flow
```
Backend Config → Redux State → Components → Utility Functions
     ↓              ↓              ↓              ↓
  (source)      (storage)    (consumers)    (processors)
```

## Implementation Plan

### Phase 1: Remove Harmful Code (CRITICAL)

#### 1.1 Fix Validation in stakingThunks.ts
**File**: `src/lbry_fun_frontend/src/features/swap/thunks/stakingThunks.ts`
**Lines**: 345-353

**Current (BROKEN):**
```typescript
let distributionIntervalSeconds = 3600; // Default to 1 hour
if (config && config.length > 0 && config[0]?.distribution_interval_seconds) {
  distributionIntervalSeconds = Number(config[0].distribution_interval_seconds);
  // THIS BREAKS TEST NETWORKS!
  if (distributionIntervalSeconds < 60 || distributionIntervalSeconds > 86400) {
    console.warn(`Unusual distribution interval: ${distributionIntervalSeconds}s, using default`);
    distributionIntervalSeconds = 3600; // OVERWRITES CORRECT VALUE!
  }
}
```

**Fixed:**
```typescript
// Get distribution interval from config - trust backend values
let distributionIntervalSeconds = 3600; // Default only if not provided
if (config && config.length > 0 && config[0]?.distribution_interval_seconds) {
  distributionIntervalSeconds = Number(config[0].distribution_interval_seconds);
  // Log unusual values but don't override
  if (distributionIntervalSeconds < 60 || distributionIntervalSeconds > 86400) {
    console.info(`Non-standard distribution interval: ${distributionIntervalSeconds}s`);
  }
}
```

### Phase 2: Parameterize Utility Functions

#### 2.1 Update treasury.ts
**File**: `src/lbry_fun_frontend/src/utils/treasury.ts`

**Current:**
```typescript
export const calculateTimeUntilNextDistribution = (lastDistribution: bigint): string => {
  const now = Date.now() * 1_000_000;
  const timeSinceLastDistribution = now - Number(lastDistribution);
  const hourInNanos = 60 * 60 * 1_000_000_000; // HARDCODED!
  const timeUntilNext = hourInNanos - (timeSinceLastDistribution % hourInNanos);
  // ...
}
```

**Fixed:**
```typescript
export const calculateTimeUntilNextDistribution = (
  lastDistribution: bigint, 
  intervalSeconds: number = 3600
): string => {
  // Guard against invalid intervals
  if (!intervalSeconds || intervalSeconds <= 0) {
    console.error(`Invalid interval: ${intervalSeconds}s, using default`);
    intervalSeconds = 3600;
  }
  
  const now = Date.now() * 1_000_000;
  const timeSinceLastDistribution = now - Number(lastDistribution);
  const intervalNanos = intervalSeconds * 1_000_000_000;
  const timeUntilNext = intervalNanos - (timeSinceLastDistribution % intervalNanos);
  
  const minutes = Math.floor(timeUntilNext / (60 * 1_000_000_000));
  const hours = Math.floor(minutes / 60);
  
  if (minutes < 1) {
    return 'Less than 1 minute';
  } else if (minutes < 60) {
    return `In ~${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else if (hours < 24) {
    const remainingMins = minutes % 60;
    return remainingMins > 0 
      ? `In ~${hours}h ${remainingMins}m`
      : `In ~${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    const days = Math.floor(hours / 24);
    return `In ~${days} day${days > 1 ? 's' : ''}`;
  }
};
```

#### 2.2 Update distributionUtils.ts
**File**: `src/lbry_fun_frontend/src/features/swap/utils/distributionUtils.ts`

**Current:**
```typescript
export const getNextDistributionTime = (intervalSeconds: bigint): Date => {
  const now = Date.now();
  const intervalMs = Number(intervalSeconds) * 1000;
  const nextTime = Math.ceil(now / intervalMs) * intervalMs;
  return new Date(nextTime);
};
```

**Enhanced with Guards:**
```typescript
export const getNextDistributionTime = (intervalSeconds: bigint): Date => {
  // Guard against invalid intervals
  const interval = Number(intervalSeconds);
  if (!interval || interval <= 0) {
    console.error(`Invalid interval for next distribution: ${interval}s, using default`);
    const defaultInterval = 3600; // 1 hour default
    const intervalMs = defaultInterval * 1000;
    const now = Date.now();
    const nextTime = Math.ceil(now / intervalMs) * intervalMs;
    return new Date(nextTime);
  }
  
  const now = Date.now();
  const intervalMs = interval * 1000;
  const nextTime = Math.ceil(now / intervalMs) * intervalMs;
  return new Date(nextTime);
};
```

### Phase 3: Update Components

#### 3.1 Fix DistributionOverview.tsx
**File**: `src/lbry_fun_frontend/src/features/swap/components/distribution/DistributionOverview.tsx`

**Current:**
```typescript
const DistributionOverview: React.FC<DistributionOverviewProps> = ({ summary }) => {
  const [countdown, setCountdown] = useState<string>('--');

  useEffect(() => {
    // Assuming 1-hour intervals (3600 seconds) - HARDCODED!
    const nextDistTime = getNextDistributionTime(3600n);
    // ...
  }, [summary.total_cycles]);
```

**Fixed:**
```typescript
import { useAppSelector } from '@/store/hooks/storeHooks';

interface DistributionOverviewProps {
  summary: DistributionSummary;
}

const DistributionOverview: React.FC<DistributionOverviewProps> = ({ summary }) => {
  const [countdown, setCountdown] = useState<string>('--');
  const distributionInterval = useAppSelector(state => state.swap.distributionInterval);

  useEffect(() => {
    // Use actual interval from state, fallback to 3600 if not loaded
    const intervalSeconds = distributionInterval || 3600;
    const nextDistTime = getNextDistributionTime(BigInt(intervalSeconds));
    
    const updateCountdown = () => {
      setCountdown(formatCountdown(nextDistTime));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [summary.total_cycles, distributionInterval]); // Add distributionInterval to deps
```

#### 3.2 Update Components Using Treasury Utils
Need to find and update all components using `calculateTimeUntilNextDistribution` to pass the interval parameter.

**Search for callers:**
```bash
grep -r "calculateTimeUntilNextDistribution" --include="*.tsx" --include="*.ts"
```

For each caller, update to pass `distributionInterval` from Redux state.

### Phase 4: Ensure Consistent Display

#### 4.1 Create Centralized Interval Formatter
**New utility function in distributionUtils.ts:**
```typescript
export const formatDistributionInterval = (seconds: number): string => {
  // Guard against invalid values
  if (!seconds || seconds <= 0) {
    return 'INVALID INTERVAL';
  }
  
  if (seconds < 60) {
    return `${seconds} SECOND${seconds !== 1 ? 'S' : ''}`;
  } else if (seconds < 3600) {
    const minutes = seconds / 60;
    // Handle partial minutes (e.g., 90 seconds = 1.5 minutes)
    if (minutes % 1 !== 0 && seconds < 120) {
      return `${seconds} SECONDS`;
    }
    return `${Math.floor(minutes)} MINUTE${Math.floor(minutes) !== 1 ? 'S' : ''}`;
  } else if (seconds < 86400) {
    const hours = seconds / 3600;
    // Handle partial hours (e.g., 5400 seconds = 1.5 hours)
    if (hours % 1 !== 0) {
      const decimalHours = hours.toFixed(1);
      return `${decimalHours} HOURS`;
    }
    return `${Math.floor(hours)} HOUR${Math.floor(hours) !== 1 ? 'S' : ''}`;
  } else {
    const days = seconds / 86400;
    // Handle partial days
    if (days % 1 !== 0) {
      const decimalDays = days.toFixed(1);
      return `${decimalDays} DAYS`;
    }
    return `${Math.floor(days)} DAY${Math.floor(days) !== 1 ? 'S' : ''}`;
  }
};
```

#### 4.2 Update StakeContent.tsx
The component already correctly uses `swap.distributionInterval` but can be improved with the formatter:

**Current lines 196-201:**
```typescript
{swap.distributionInterval ? 
  `[EVERY ${swap.distributionInterval < 3600 ? 
    `${Math.floor(swap.distributionInterval / 60)} MINUTE${Math.floor(swap.distributionInterval / 60) > 1 ? 'S' : ''}` :
    // ... complex nested logic
  }]` : 
  '[LOADING...]'
}
```

**Fixed:**
```typescript
{swap.distributionInterval ? 
  `[EVERY ${formatDistributionInterval(swap.distributionInterval)}]` : 
  '[LOADING...]'
}
```

### Phase 5: Testing Strategy

#### 5.1 Unit Tests
```typescript
describe('Distribution Interval Handling', () => {
  test('formatDistributionInterval handles all ranges', () => {
    expect(formatDistributionInterval(30)).toBe('30 SECONDS');
    expect(formatDistributionInterval(60)).toBe('1 MINUTE');
    expect(formatDistributionInterval(3600)).toBe('1 HOUR');
    expect(formatDistributionInterval(86400)).toBe('1 DAY');
  });

  test('formatDistributionInterval handles partial units', () => {
    expect(formatDistributionInterval(5400)).toBe('1.5 HOURS');
    expect(formatDistributionInterval(129600)).toBe('1.5 DAYS');
    expect(formatDistributionInterval(7200)).toBe('2 HOURS');
  });

  test('formatDistributionInterval handles invalid inputs', () => {
    expect(formatDistributionInterval(0)).toBe('INVALID INTERVAL');
    expect(formatDistributionInterval(-100)).toBe('INVALID INTERVAL');
    expect(formatDistributionInterval(null)).toBe('INVALID INTERVAL');
  });

  test('calculateTimeUntilNextDistribution uses custom interval', () => {
    const lastDist = BigInt(Date.now() - 30000) * 1000000n; // 30 seconds ago
    const result = calculateTimeUntilNextDistribution(lastDist, 60); // 1 minute interval
    expect(result).toContain('30 second');
  });

  test('calculateTimeUntilNextDistribution handles missing interval gracefully', () => {
    const lastDist = BigInt(Date.now() - 1800000) * 1000000n; // 30 minutes ago
    const result = calculateTimeUntilNextDistribution(lastDist, undefined);
    expect(result).toBeDefined();
    // Should use 3600 default, so ~30 minutes remaining
    expect(result).toContain('30 minute');
  });

  test('calculateTimeUntilNextDistribution handles invalid intervals', () => {
    const lastDist = BigInt(Date.now()) * 1000000n;
    const result1 = calculateTimeUntilNextDistribution(lastDist, 0);
    const result2 = calculateTimeUntilNextDistribution(lastDist, -100);
    // Both should use 3600 default
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });
});
```

#### 5.2 Integration Tests
1. Deploy token with 60-second interval
2. Verify UI shows "[EVERY 1 MINUTE]"
3. Check APY calculation uses 60-second interval
4. Confirm countdown shows ~30 seconds when halfway through
5. Verify distribution actually occurs at 60-second mark

#### 5.3 Edge Cases to Test
- [ ] 30-second interval (extreme test case)
- [ ] 1-minute interval (common test network)
- [ ] 1-hour interval (production default)
- [ ] 24-hour interval (slow distribution)
- [ ] 7-day interval (extreme slow)

## Migration Checklist

### Pre-Implementation
- [ ] Back up current code
- [ ] Document current broken behavior with screenshots
- [ ] Set up test token with 60-second interval

### Implementation Order
1. [ ] Fix stakingThunks.ts validation (Critical)
2. [ ] Update treasury.ts functions with guards
3. [ ] Create formatDistributionInterval utility with edge case handling
4. [ ] Update DistributionOverview component
5. [ ] Update StakeContent display
6. [ ] Find and fix all calculateTimeUntilNextDistribution callers
7. [ ] Clean up any remaining hardcoded intervals
8. [ ] Update code comments mentioning "hourly" or "1 hour" intervals
9. [ ] Search and update markdown documentation for hardcoded interval references

### Post-Implementation
- [ ] Test with 60-second interval token
- [ ] Test with 3600-second interval token  
- [ ] Test with 86400-second interval token
- [ ] Verify APY calculations are correct
- [ ] Confirm countdown timers are accurate
- [ ] Document the fix in CHANGELOG

## Potential Risks & Mitigations

### Risk 1: Breaking Existing Tokens
**Mitigation**: Changes only affect display, not actual distribution logic

### Risk 2: Performance Impact
**Mitigation**: Interval value is cached in Redux, no additional API calls

### Risk 3: Timer Synchronization
**Mitigation**: Use consistent time source (Date.now()) across all components

### Risk 4: Edge Case Intervals
**Mitigation**: Guard clauses prevent division by zero and handle invalid inputs

## Backwards Compatibility Notes

### Safe Changes
- All changes are frontend display only
- Backend distribution logic remains untouched
- Existing tokens will display correctly once fixed
- No database migrations required

### Breaking Changes
- None - this is purely a frontend fix

### Migration Path
1. Deploy frontend with fixes
2. Clear browser cache if needed
3. Existing tokens automatically display correct intervals
4. No action required from token creators

## Success Criteria
1. ✅ Test networks with 60-second intervals display correctly
2. ✅ APY calculations use actual interval, not hardcoded 3600
3. ✅ Countdown timers show accurate time to next distribution
4. ✅ No hardcoded interval values remain in frontend code
5. ✅ All utility functions accept interval as parameter

## Code Review Points
- No magic numbers (3600, 86400) without clear context
- All interval-dependent calculations use the Redux state value
- Utility functions remain pure (no state dependencies)
- Error handling for missing/invalid intervals
- Documentation and comments updated to be interval-agnostic

## Search Commands for Cleanup
```bash
# Find hardcoded hour references in code
grep -r "1 hour\|one hour\|hourly\|every hour" --include="*.ts" --include="*.tsx"

# Find hardcoded 3600 references
grep -r "3600\|86400" --include="*.ts" --include="*.tsx"

# Find interval references in documentation
grep -r "hour\|hourly\|1 hour" --include="*.md"

# Find comments mentioning specific intervals
grep -r "// .*hour\|/\* .*hour" --include="*.ts" --include="*.tsx"
```

## Future Improvements
1. Add interval validation warnings (not overrides) in UI
2. Show interval in more places for transparency
3. Add "time since last distribution" display
4. Consider caching next distribution time in Redux
5. Add interval change detection and UI updates