# Tokenomics Graph "We Are Here" Indicator Improvements

## Overview
This document outlines improvements needed for the "we are here" indicator on tokenomics graphs. The indicator shows the current distribution progress but has visibility issues that need to be fixed.

## Current Implementation Status

### Data Fetching Architecture
The current state data is fetched via:
- **Thunk**: `fetchTokenomicsCurrentState` in `/src/lbry_fun_frontend/src/features/swap/thunks/tokenomicsThunks.ts`
- **State Management**: Stored in `tokenomicsCurrentState` in the swap slice
- **Data Structure**:
  ```typescript
  interface TokenomicsCurrentState {
    totalSecondaryBurned: string;  // Total secondary tokens burned (E8S)
    totalPrimaryMinted: string;    // Total primary tokens minted (E8S)
    currentThresholdIndex: number; // Current epoch (0 = TGE, 1+ = epochs)
  }
  ```

### Component Architecture
1. **TokenomicsTab** (`/src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx`)
   - Passes `currentState` prop to UnifiedTokenomicsGraphs
   
2. **UnifiedTokenomicsGraphs** (`/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphs.tsx`)
   - Calculates positions in `currentPositions` useMemo (lines 186-199)
   - Passes position data to each LineChart

3. **LineChart** (`/src/lbry_fun_frontend/src/features/swap/components/Chart.tsx`)
   - Accepts `currentPositionX` and `showCurrentPosition` props
   - Renders vertical line with label using ECharts markLine

## Problem: Label Visibility

The "we are here" label appears as a white blob due to theme color conflicts. The terminal uses a dark/cypherpunk theme but the label styling doesn't account for this.

## Implementation Tasks

### 1. Fix Label Visibility in Chart Component

**File**: `/src/lbry_fun_frontend/src/features/swap/components/Chart.tsx`

**Current Issue** (lines 140-150):
```javascript
label: {
    backgroundColor: 'hsl(var(--background))',  // This is likely white
    color: 'hsl(var(--color-chart-accent))',   // May not have enough contrast
}
```

**Solution**: Use explicit terminal-themed colors
```javascript
label: {
    show: true,
    formatter: '▼ We are here',  // Add ASCII arrow for terminal aesthetic
    position: 'end',
    color: '#00ff00',  // Lime green for terminal theme
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',  // Dark background with slight transparency
    padding: [6, 10],
    borderRadius: 4,
    borderColor: '#00ff00',
    borderWidth: 1,
    shadowColor: '#00ff00',
    shadowBlur: 10  // Add glow effect
}
```

### 2. Enhance Line Styling

**Update the markLine lineStyle** (lines 135-139):
```javascript
lineStyle: {
    color: '#00ff00',  // Match terminal theme
    type: 'dashed',
    width: 2,
    opacity: 0.8
}
```

### 3. Add Position Context to Labels

**File**: `/src/lbry_fun_frontend/src/features/token/components/UnifiedTokenomicsGraphs.tsx`

Instead of passing just the position, pass additional context for better labels:

1. **Update the currentPositions calculation** (lines 186-199) to include formatted values:
```javascript
const currentPositions = useMemo(() => {
    if (!currentState) return null;
    
    const totalBurned = Number(currentState.totalSecondaryBurned) / E8S;
    const totalMinted = Number(currentState.totalPrimaryMinted) / E8S;
    const currentEpoch = currentState.currentThresholdIndex;
    
    return {
        burnedPosition: totalBurned,
        burnedLabel: `${totalBurned.toLocaleString()} burned`,
        mintedPosition: totalMinted,
        mintedLabel: `${totalMinted.toLocaleString()} minted`,
        epochPosition: currentEpoch > 0 ? `Epoch ${currentEpoch}` : 'TGE',
        epochLabel: currentEpoch > 0 ? `Epoch ${currentEpoch}` : 'Token Generation'
    };
}, [currentState]);
```

2. **Add a new prop to LineChart** for custom labels

### 4. Apply to All Graphs Consistently

Verify all four graphs have indicators:
- ✅ Line 355: Cumulative Supply vs Burn
- ✅ Line 371: Primary per Epoch  
- ✅ Line 387: Cost to Mint
- ✅ Line 407: Minting Valuation

### 5. Handle Edge Cases

Add guards in the LineChart component:
```javascript
// Ensure position is within data bounds
if (currentPositionX !== undefined && dataXaxis.length > 0) {
    const minX = Math.min(...dataXaxis.map(x => Number(x)));
    const maxX = Math.max(...dataXaxis.map(x => Number(x)));
    const clampedPosition = Math.max(minX, Math.min(maxX, Number(currentPositionX)));
    // Use clampedPosition for markLine
}
```

## Design Principles

### 1. **Simplicity**
- No additional API calls needed
- Reuse existing data structures
- Minimal changes to component interfaces

### 2. **Modularity**
- Chart component remains generic and reusable
- Position calculation stays in UnifiedTokenomicsGraphs
- Theme-specific styling isolated to Chart component

### 3. **Consistency**
- Use terminal color palette throughout (#00ff00 for highlights)
- Match existing terminal UI patterns (ASCII characters, monospace text)
- Maintain same indicator style across all graphs

### 4. **Performance**
- Use memoization for position calculations
- Avoid unnecessary re-renders
- Keep calculations in E8S to natural conversions consistent

## Testing Considerations

1. **Visual Testing**
   - Label clearly visible on dark background
   - No overlap with graph elements
   - Consistent appearance across all graphs

2. **Data Accuracy**
   - Position matches actual burned/minted amounts
   - Epoch indicator shows correct epoch
   - Edge cases (epoch 0, no burns) handled gracefully

3. **Responsive Design**
   - Labels remain visible on mobile
   - No text cutoff on smaller screens
   - Position remains accurate when graph resizes

## Code Quality Checklist

- [ ] Follow existing code patterns in Chart.tsx
- [ ] Use TypeScript types properly
- [ ] No hardcoded values (use constants/theme variables where possible)
- [ ] Add comments only where behavior is non-obvious
- [ ] Test with both light and dark themes (if applicable)
- [ ] Ensure no console errors or warnings

## Additional Notes

- The current implementation already fetches all necessary data
- Focus should be on presentation layer improvements only
- Maintain backward compatibility with other uses of LineChart component
- Consider extracting terminal theme colors to constants if not already done