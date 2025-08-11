# Terminal UI Refactor: Concrete Implementation Plan

## Initiative 1: Delete terminal.css and Go Tailwind-Only

### Files to Modify (43 files, ~738 class references)

#### Step 1: Delete CSS Files
```
DELETE /src/lbry_fun_frontend/src/styles/terminal.css (512 lines)
DELETE /src/lbry_fun_frontend/src/styles/terminal-forms.css (if exists)
```

#### Step 2: Find/Replace Patterns for All 43 Files

**Core Replacements:**
```
terminal-pure         → bg-black border border-white/30 font-mono text-sm p-3
terminal-row          → flex justify-between items-center py-0.5
terminal-label        → text-gray-400 text-xs
terminal-value        → text-white text-sm
terminal-primary      → text-lime-500 font-bold text-sm
terminal-accent       → text-gray-600 text-xs
terminal-prompt       → text-pink-500
terminal-header       → font-mono font-bold text-white mb-1 text-sm uppercase
terminal-input        → bg-transparent text-white font-mono text-sm placeholder-gray-600 focus:outline-none w-full
terminal-button       → bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10
terminal-button-primary → bg-lime-500 text-black border-0 font-bold hover:bg-lime-400
terminal-status       → text-pink-500 text-xs uppercase
terminal-error        → text-red-500 font-bold uppercase
terminal-success      → text-lime-500 font-bold uppercase
terminal-section      → border-t border-white/30 mt-2 pt-1
terminal-card         → bg-black border border-white/30 font-mono text-sm p-4
```

**Example Change in StakeContent.tsx:**
```tsx
// BEFORE (Line 191-193)
<div className="terminal-row">
    <span className="terminal-label">staked_amount:</span>
    <span className="terminal-primary">{value}</span>
</div>

// AFTER
<div className="flex justify-between items-center py-0.5">
    <span className="text-gray-400 text-xs">staked_amount:</span>
    <span className="text-lime-500 font-bold text-sm">{value}</span>
</div>
```

### Net Code Impact
- **Deleted:** 512 lines (terminal.css)
- **Modified:** ~738 class references across 43 files
- **Result:** Same visual output, zero custom CSS

---

## Initiative 2: Create 5 Reusable Terminal Components

### New Files to Create

#### 1. `/src/lbry_fun_frontend/src/components/terminal/TerminalRow.tsx` (15 lines)
```tsx
interface Props {
  label: string;
  value: string | number;
  unit?: string;
  accent?: boolean;
}

export const TerminalRow = ({ label, value, unit, accent }: Props) => (
  <div className="flex justify-between items-center py-0.5">
    <span className="text-gray-400 text-xs">{label}:</span>
    <span className={accent ? "text-lime-500 font-bold text-sm" : "text-white text-sm"}>
      {value} {unit && <span className="text-lime-500">{unit}</span>}
    </span>
  </div>
);
```

#### 2. `/src/lbry_fun_frontend/src/components/terminal/TerminalInput.tsx` (25 lines)
```tsx
interface Props {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
}

export const TerminalInput = ({ value, onChange, ...props }: Props) => (
  <input
    className="bg-transparent text-white font-mono text-sm placeholder-gray-600 
               focus:outline-none w-full text-right"
    value={value}
    onChange={onChange}
    {...props}
  />
);
```

#### 3. `/src/lbry_fun_frontend/src/components/terminal/TerminalButton.tsx` (20 lines)
```tsx
interface Props {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export const TerminalButton = ({ children, primary, ...props }: Props) => (
  <button
    className={`
      ${primary 
        ? 'bg-lime-500 text-black border-0 font-bold hover:bg-lime-400' 
        : 'bg-black border border-white/30 text-white hover:bg-white/10'}
      font-mono text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed w-full
    `}
    {...props}
  >
    {props.loading ? <LoaderCircle className="animate-spin mx-auto" size={14} /> : children}
  </button>
);
```

#### 4. `/src/lbry_fun_frontend/src/components/terminal/TerminalSection.tsx` (12 lines)
```tsx
interface Props {
  title: string;
  children: React.ReactNode;
}

export const TerminalSection = ({ title, children }: Props) => (
  <div className="border-t border-white/30 mt-2 pt-1">
    <div className="mb-2">
      <span className="text-pink-500">&gt;</span> 
      <span className="text-xs uppercase text-gray-400">{title}</span>
    </div>
    {children}
  </div>
);
```

#### 5. `/src/lbry_fun_frontend/src/components/terminal/TerminalContainer.tsx` (18 lines)
```tsx
interface Props {
  title: string;
  status?: string;
  children: React.ReactNode;
}

export const TerminalContainer = ({ title, status, children }: Props) => (
  <div className="bg-black border border-white/30 font-mono text-sm p-3">
    <div className="flex justify-between items-center mb-4">
      <div>
        <span className="text-pink-500">&lt;&lt;</span>
        <span className="font-bold text-white uppercase ml-1">{title}</span>
      </div>
      {status && <span className="text-lime-500 text-xs uppercase">[{status}]</span>}
    </div>
    {children}
  </div>
);
```

### Files to Refactor Using New Components

#### Example: StakeContent.tsx Refactor
```tsx
// BEFORE: 288 lines with inline styles
// AFTER: ~150 lines using components

import { TerminalRow, TerminalInput, TerminalButton, TerminalSection, TerminalContainer } from '@/components/terminal';

// Replace lines 189-223 with:
<TerminalSection title="STAKE_INTERFACE">
  <TerminalRow label="staked_amount" value={swap.stakeInfo.stakedPrimary} unit={symbol} accent />
  <TerminalRow label="reward_interval" value={formatInterval(swap.distributionInterval)} />
  <TerminalRow label="current_apy" value={`${swap.averageAPY?.toFixed(2)}%`} />
  <TerminalRow label="total_staked" value={swap.totalStaked} unit={symbol} accent />
  <TerminalRow label="stakers" value={swap.totalStakers} />
</TerminalSection>

// Replace lines 225-250 with:
<TerminalSection title="STAKE_AMOUNT">
  <TerminalRow label="amount">
    <TerminalInput value={amount} onChange={handleAmountChange} type="number" min={0} />
  </TerminalRow>
  <TerminalRow label="available_balance" value={primary.primaryBal} unit={symbol}>
    <button onClick={handleMaxPrimary}>[max]</button>
  </TerminalRow>
  <TerminalButton primary disabled={!canStake} onClick={handleSubmit} loading={isLoading}>
    [STAKE]
  </TerminalButton>
</TerminalSection>
```

### Files to Refactor (Priority Order)

1. **StakeContent.tsx** - 288 → ~150 lines (-138 lines)
2. **SwapContent.tsx** - Similar reduction expected
3. **BurnContent.tsx** - Similar reduction expected
4. **TransferContent.tsx** - Similar reduction expected
5. **StakeInfo.tsx** - 182 → ~80 lines (-102 lines)
6. **UnifiedInfoDisplay.tsx** - Can use TerminalRow throughout
7. **TokenomicsTab.tsx** - Replace all data displays
8. **TreasuryTab.tsx** - Replace all data displays
9. **CanisterStats.tsx** - Use TerminalRow for all stats
10. **Insights.tsx** - Use TerminalSection for grouping

### Total Impact

#### Lines of Code
**Deleted:**
- terminal.css: -512 lines
- Refactored components: ~-800 lines (estimated 40% reduction)

**Added:**
- 5 new components: +90 lines

**Net Reduction: ~1,222 lines**

#### File Count
**Deleted:**
- terminal.css
- TerminalExpander.tsx
- TerminalBase.tsx
- TerminalUtils.tsx

**Added:**
- 5 terminal primitive components

**Net Reduction: 0 files (but much cleaner structure)**

### Migration Steps

1. **Day 1 Morning:**
   - Create 5 terminal components
   - Test with StakeContent.tsx as pilot

2. **Day 1 Afternoon:**
   - Global find/replace terminal classes → Tailwind
   - Delete terminal.css
   - Fix any visual regressions

3. **Day 2:**
   - Refactor remaining terminals using new components
   - Delete unnecessary wrapper components

### Validation Checklist
- [ ] All terminals render identically
- [ ] No horizontal scrolling on mobile
- [ ] Consistent spacing (0.5rem between rows)
- [ ] Text remains readable (gray-400 for labels)
- [ ] Inputs align right consistently
- [ ] Buttons full width in containers