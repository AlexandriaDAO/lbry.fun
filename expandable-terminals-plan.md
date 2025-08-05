# Expandable Main Terminals Plan

## Goal
Create simple, clean expandable/collapsible functionality for the 4 main terminal containers only:
- WALLET_TERMINAL (in ConsolidatedTerminal)
- TRADING_TERMINAL
- STAKING_TERMINAL
- ANALYTICS_TERMINAL

## Visual Design
- Collapsed: `>> TERMINAL_NAME[STATUS]`
- Expanded: `⌄⌄ TERMINAL_NAME[STATUS]`

## Implementation Strategy

### 1. Create Reusable TerminalExpander Component

```typescript
interface TerminalExpanderProps {
  title: string;
  status?: string; // e.g., "[LIVE]", "[ACTIVE]"
  children: React.ReactNode;
  defaultExpanded?: boolean;
  terminalId: string; // for localStorage persistence
}
```

Features:
- Click header to toggle
- Smooth height animation
- Preserve state in localStorage
- Clean terminal aesthetic

### 2. Component Structure
Each terminal will be wrapped:
```tsx
<TerminalExpander 
  title="WALLET_TERMINAL" 
  status="[LIVE]"
  terminalId="wallet"
  defaultExpanded={true}
>
  {/* All existing terminal content */}
</TerminalExpander>
```

### 3. State Persistence
- Use localStorage to remember user's expanded/collapsed preferences
- Key format: `terminal_expanded_${terminalId}`
- Default all to expanded on first visit

### 4. Styling
- Keep existing terminal styles
- Add subtle hover effect on header
- Smooth CSS transition for height changes
- Maintain monospace font and terminal colors

## Benefits
- Cleaner UI with ability to focus on specific terminals
- Better mobile experience
- Reduced visual clutter
- User preference persistence

## What NOT to Do
- Don't add expanders to small components
- Don't over-animate
- Don't break existing terminal aesthetics
- Don't add unnecessary icons or decorations

## Implementation Details

### File Locations for the 4 Main Terminals
1. **WALLET_TERMINAL**: `/src/features/swap/components/ConsolidatedTerminal.tsx`
2. **TRADING_TERMINAL**: `/src/features/swap/components/TradingTerminal.tsx`
3. **STAKING_TERMINAL**: `/src/features/swap/components/StakingTerminal.tsx`
4. **ANALYTICS_TERMINAL**: `/src/features/swap/components/AnalyticsTerminal.tsx`

### CSS Approach
```css
.terminal-expander-header {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.terminal-expander-header:hover {
  background-color: rgba(132, 204, 22, 0.1); /* subtle lime glow */
}

.terminal-expander-content {
  overflow: hidden;
  transition: max-height 0.3s ease-out;
}

.terminal-expander-content.collapsed {
  max-height: 0;
}

.terminal-expander-content.expanded {
  max-height: 9999px; /* Will be calculated dynamically */
}
```