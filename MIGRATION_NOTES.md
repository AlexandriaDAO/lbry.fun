# Frontend Field Upgrade Migration Notes

## Breaking Changes

### Removed Utilities
The following functions have been removed from `@/utils/tokenStatus`:
- `calculateTokenStatus()` - Used non-existent backend fields
- `calculateCountdown()` - Logic moved to `useAccessState` hook
- `parseTokenTimings()` - Parsed non-existent backend fields

**Migration:** If you were using these functions:
1. For token status, use the `isLive` field directly from `TokenRecordStringified`
2. For countdown logic, use the `useAccessState` hook which provides `countdown` and `launchTime`
3. Only `formatCountdown()` remains available for formatting seconds to human-readable strings

### Updated Type Definition
`TokenRecordStringified` now includes:
- `threshold_multiplier: number`
- `distribution_interval_seconds: string`
- Removed references to `pool_created_at` and `pool_creation_failed`

### API Method Names
- Backend method `get_upcomming()` has been renamed to `get_upcoming()`
- Frontend still uses "upcomming" in several places (to be fixed in future update)

## Deprecated Patterns

### Manual Status Calculation
```typescript
// OLD - Don't do this
const status = calculateTokenStatus(createdAt, launchDelay, poolCreationFailed, poolCreatedAt);
const isLive = status === 'live';

// NEW - Use the field directly
const isLive = tokenRecord.isLive;
```

### Complex Countdown Logic
```typescript
// OLD - Don't recalculate
const { seconds, isLive } = calculateCountdown(createdAt, launchDelay);

// NEW - Use the hook
const { countdown, launchTime, isTokenLive } = useAccessState();
```

## Safety Improvements

The `useAccessState` hook now includes:
- Fallback to `created_time` if `launched_at` is not set
- Validation for reasonable timestamp values
- Try-catch error handling for BigInt conversions
- Console warnings for invalid data

## Future Considerations

1. **Spelling Consistency**: The frontend uses "upcomming" in multiple places while the backend uses "upcoming". This should be fixed in a future update.
2. **Test Updates**: Test files may need updating to match the new implementation.
3. **Type Safety**: Consider adding runtime validation for backend responses to ensure fields exist before use.