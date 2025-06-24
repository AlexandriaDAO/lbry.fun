# Cypherpunk Homepage Migration Plan

## Overview
This document outlines the migration strategy for converting the existing token pools homepage (`getTokenPools.tsx`) to follow the pure terminal aesthetic of the Cypherpunk design system. The goal is to remove visual bloat, consolidate components, and create a dense, information-rich interface.

## Current State Analysis

### File: `/src/features/token/components/getTokenPools.tsx`
- **Lines**: 260
- **Key Issues**:
  - Heavy use of gradients and decorative styling
  - Card-based layout with shadows and hover effects  
  - Complex animations (scale, pulse, opacity transitions)
  - TokenLogo component with fallback gradient styling
  - Excessive color variations and visual noise

### Bloat to Remove
1. **Gradient Classes** (39 instances):
   - `bg-gradient-to-r from-primary to-primary/80`
   - `bg-gradient-to-br from-card to-card/80`
   - `bg-gradient-to-r from-green-500 to-emerald-500`
   - `bg-gradient-to-r from-orange-500 to-amber-500`
   - `bg-gradient-to-br from-primary/30 to-primary/60`

2. **Animation Classes** (8 instances):
   - `animate-pulse`
   - `hover:scale-[1.03]`
   - `transition-all duration-300`
   - `transition-opacity duration-300`
   - `hover:shadow-xl`

3. **Shadow Classes** (5 instances):
   - `shadow-lg`
   - `shadow-xl`
   - `shadow-green-500/25`
   - `shadow-orange-500/25`

4. **Decorative Elements**:
   - Emoji indicators (🟢, 🔶, ➕, 🔄, 📊)
   - Animated dots
   - Complex hover states
   - Card components with multiple nested divs

## Migration Strategy

### Phase 1: Component Architecture

#### 1.1 Create Terminal Pool List Component
**New File**: `/src/features/token/components/terminal/TerminalPoolList.tsx`

```tsx
// Consolidated component replacing the card-based grid
const TerminalPoolList: React.FC = () => {
  // Single consolidated view with minimal state
  // Dense table-like layout instead of cards
}
```

#### 1.2 Consolidate TokenLogo into Simple Text Display
- Remove complex logo fetching logic (lines 19-100)
- Replace with simple symbol display: `[ALEX]` or `[LBRY]`
- No images, gradients, or fallback styling

### Phase 2: CSS Utility Classes

Create terminal-specific utilities in `/src/styles/terminal.css`:

```css
.terminal-pool-container {
  @apply bg-black border border-white/30 font-mono text-sm p-3;
}

.terminal-pool-header {
  @apply flex justify-between items-center border-b border-white/30 pb-2 mb-2;
}

.terminal-pool-row {
  @apply flex justify-between items-center py-1 hover:bg-white/5;
}

.terminal-pool-label {
  @apply text-gray-400 text-xs;
}

.terminal-pool-value {
  @apply text-white text-sm;
}

.terminal-pool-status {
  @apply text-pink-500 text-xs uppercase;
}

.terminal-pool-id {
  @apply text-cyan-400 font-mono text-xs;
}
```

### Phase 3: Component Structure

#### Before (Current Card Layout):
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {tokenPools?.map(([id, record]) => (
    <Card className="group hover:shadow-xl transition-all duration-300...">
      {/* Complex nested structure */}
    </Card>
  ))}
</div>
```

#### After (Terminal Table Layout):
```tsx
<div className="terminal-pool-container">
  <div className="terminal-pool-header">
    <span className="terminal-prompt">&gt;</span> active_pools
    <span className="terminal-status">[{tokenPools.length} LIVE]</span>
  </div>
  
  <div className="space-y-0">
    {tokenPools?.map(([id, record]) => (
      <TerminalPoolRow key={id} pool={record} poolId={id} />
    ))}
  </div>
</div>
```

### Phase 4: New Terminal Pool Row Component

**File**: `/src/features/token/components/terminal/TerminalPoolRow.tsx`

```tsx
const TerminalPoolRow: React.FC<{pool: PoolRecord, poolId: string}> = ({ pool, poolId }) => {
  return (
    <div className="terminal-pool-row">
      <div className="flex-1 space-x-4">
        <span className="terminal-pool-id">#{poolId}</span>
        <span className="terminal-pool-value">[{pool.primary_token_symbol}]</span>
        <span className="terminal-pool-label">tvl:</span>
        <span className="terminal-primary">${formatTvl(pool.tvl)}</span>
        <span className="terminal-pool-status">
          {pool.isLive ? '[LIVE]' : '[PENDING]'}
        </span>
      </div>
      <div className="flex space-x-2">
        <button className="terminal-action" onClick={() => navigate(`/swap?id=${poolId}`)}>
          &gt; trade
        </button>
        <button className="terminal-action">
          &gt; kong
        </button>
      </div>
    </div>
  );
};
```

### Phase 5: Remove Dependencies

#### Files/Components to Delete:
1. `TokenLogo` component (lines 19-100)
2. All Card imports from shadcn
3. Button component (replace with terminal-style buttons)

#### Imports to Remove:
```tsx
// Remove these
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/lib/components/card";
import { Button } from "@/lib/components/button";

// Keep only essential imports
import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useNavigate } from "react-router-dom";
```

### Phase 6: Data Display Patterns

#### Current (Complex TVL Display):
```tsx
<div className="flex items-center justify-between p-2 bg-primary/5 rounded-lg border border-primary/10">
  <span className="text-sm font-medium text-muted-foreground">Liquidity:</span>
  <div className="text-right">
    {tvlLoading ? (
      <div className="w-16 h-4 bg-muted animate-pulse rounded" />
    ) : tvlData[id] ? (
      <span className="text-sm font-bold text-primary">
        ${TokenConversionService.formatE8sDisplay(BigInt(tvlData[id]!.tvl), 0)}
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">No liquidity</span>
    )}
  </div>
</div>
```

#### New (Terminal Style):
```tsx
<span className="terminal-pool-label">tvl:</span>
<span className="terminal-primary">
  {tvlData[id] ? `$${formatTvl(tvlData[id].tvl)}` : '$0'}
</span>
```

## Implementation Steps

### Step 1: Create Terminal Utilities (15 mins)
1. Create `/src/styles/terminal.css` with utility classes
2. Import in main CSS file
3. Test utilities with a simple component

### Step 2: Build TerminalPoolRow Component (30 mins)
1. Create `/src/features/token/components/terminal/TerminalPoolRow.tsx`
2. Implement minimal row display logic
3. Add navigation handlers

### Step 3: Convert Main Component (45 mins)
1. Backup current `getTokenPools.tsx`
2. Strip out all decorative elements
3. Replace grid layout with terminal list
4. Remove TokenLogo component
5. Simplify state management

### Step 4: Clean Dependencies (15 mins)
1. Remove unused imports
2. Delete Card component usage
3. Update any parent components

### Step 5: Testing & Polish (30 mins)
1. Test all pool display functionality
2. Verify navigation works
3. Check loading states
4. Ensure TVL displays correctly

## Expected Outcome

### Before: 260 lines → After: ~120 lines (54% reduction)

### Visual Changes:
- No cards, shadows, or gradients
- Dense table-like layout
- Monospace typography throughout
- Strategic color use (lime for TVL, pink for status, cyan for IDs)
- Pure black background
- Minimal borders

### Performance Improvements:
- Removed logo fetching (80 lines of code)
- Eliminated complex hover states
- Reduced DOM nodes by ~60%
- Faster initial render

## Code Quality Metrics

### Complexity Reduction:
- **CSS Classes per element**: 15+ → 3-4
- **Nested divs**: 8-10 levels → 2-3 levels
- **State variables**: Unchanged (already minimal)
- **Effect hooks**: 3 → 2 (remove logo fetching)

### Maintainability Gains:
- Single row component instead of complex cards
- Consolidated styling in utility classes
- Clearer data flow
- Easier to test

## Migration Checklist

- [ ] Create terminal utility classes
- [ ] Build TerminalPoolRow component
- [ ] Remove TokenLogo component
- [ ] Convert grid to terminal list
- [ ] Strip all gradients and animations
- [ ] Replace Button components
- [ ] Remove Card imports
- [ ] Update loading states
- [ ] Test navigation
- [ ] Verify TVL display
- [ ] Clean up unused code
- [ ] Update parent components if needed

## Notes

- The create token button should move to terminal style: `> create_token` instead of gradient button
- Consider adding ASCII art header for branding
- Pool IDs should be truncated: `t677x...uae` format
- All monetary values in monospace without currency symbols in labels