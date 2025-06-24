# Cypherpunk Terminal Design System

## Overview
This design system embodies pure terminal aesthetics for crypto applications targeting developers who value functional minimalism over visual polish. Every design decision prioritizes code quality, maintainability, and authentic terminal experience.

## Design Philosophy

### Core Principles
1. **Pure Terminal**: Raw, authentic command-line interface aesthetics
2. **Code Quality First**: Clean architecture drives visual decisions
3. **Minimal Code**: Maximum functionality with minimum lines
4. **High Contrast**: Bold colors used sparingly for maximum impact
5. **Dense Information**: Pack data efficiently like real terminals
6. **Zero Decoration**: Function over form, always

### Target User
- Backend developers and DevOps engineers
- Crypto natives who live in terminals
- Users who prefer authentic tools over flashy interfaces
- Technical audiences who value substance over style

## Code-First Design Architecture

### Utility Class Strategy
Build consolidated utility classes that eliminate repetitive CSS:

```css
/* Single-purpose, highly reusable utilities */
.terminal-pure    /* Complete terminal container */
.terminal-row     /* Dense key-value row */
.terminal-section /* Section with minimal border */
.terminal-header  /* Consistent header styling */
.terminal-prompt  /* Pink > indicators */
.terminal-label   /* Gray labels */
.terminal-value   /* White text values */
.terminal-primary /* Lime green for important values */
.terminal-accent  /* Gray for USD/percentages */
.terminal-status  /* Pink status indicators */
.hex-address      /* Cyan technical identifiers */
```

### Component Consolidation Pattern
Replace multiple similar components with single, configurable ones:

**❌ Avoid: Multiple card components**
```tsx
<AccountCard />
<PoolCard />
<BalanceCard />
```

**✅ Prefer: Single consolidated component**
```tsx
<TerminalInterface />
```

## Pure Terminal Visual Language

### Color Palette (Minimal Usage)
```css
/* Use sparingly - high impact colors */
--lime-primary: #32cd32;    /* Only for most important values */
--pink-prompt: #ff1493;     /* Only for prompts and status */
--cyan-tech: #00ffff;       /* Only for hex addresses */
--white: #ffffff;           /* Standard text */
--gray-label: #9ca3af;      /* Labels only */
--gray-accent: #6b7280;     /* USD values only */
--black: #000000;           /* Background only */
--white-border: #ffffff4d;  /* Borders only */
```

### Typography Rules
```css
/* Monospace everywhere - no exceptions */
font-family: monospace;

/* Size hierarchy - minimal */
.terminal-header { font-size: 0.875rem; }  /* 14px */
.terminal-value  { font-size: 0.875rem; }  /* 14px */
.terminal-label  { font-size: 0.75rem; }   /* 12px */
.terminal-accent { font-size: 0.75rem; }   /* 12px */
```

### Naming Conventions
```
// Lowercase with underscores - terminal style
> principal_account
>> active_swap_pool 
>> balances
>> pool_metrics

// Labels - lowercase with colons
principal:
account_id:
icp:
max_supply:

// Status - uppercase in brackets
[CONNECTED]
[LIVE]
[LAUNCHING]
```

## Core Component Patterns

### Terminal Container
```tsx
// Pure black background, minimal border, dense padding
<div className="terminal-pure">
  {/* Content */}
</div>

// CSS Implementation
.terminal-pure {
  @apply bg-black border border-white/30 font-mono text-sm p-3 leading-tight;
}
```

### Information Row
```tsx
// Consistent key-value pattern
<div className="terminal-row">
  <span className="terminal-label">key:</span>
  <span className="terminal-value">value</span>
</div>

// CSS Implementation
.terminal-row {
  @apply flex justify-between items-center py-0.5;
}
```

### Section Divider
```tsx
// Minimal section separation
<div className="terminal-section">
  <div className="section-divider">
    <span className="terminal-header">
      <span className="terminal-prompt">&gt;&gt;</span> section_name
    </span>
  </div>
</div>
```

## Code Quality Standards

### Component Structure
```tsx
// ✅ Clean, minimal component structure
const TerminalInterface: React.FC = () => {
  // Minimal state - consolidate related data
  const [accountData, setAccountData] = useState(null);
  
  // Single effect for all data loading
  useEffect(() => {
    loadAllData();
  }, [principal]);

  return (
    <div className="terminal-pure">
      <Header />
      <AccountSection />
      <PoolSection />
      <BalancesSection />
      <MetricsSection />
    </div>
  );
};
```

### Avoid Code Duplication
```tsx
// ❌ Repetitive styling
<div className="flex justify-between items-center py-1">
<div className="flex justify-between items-center py-1">
<div className="flex justify-between items-center py-1">

// ✅ Utility class
<div className="terminal-row">
<div className="terminal-row">
<div className="terminal-row">
```

### Data Display Patterns
```tsx
// Standard value display
<div className="terminal-row">
  <span className="terminal-label">icp:</span>
  <div className="text-right">
    <span className="terminal-primary">24.7505</span>
    <span className="terminal-accent ml-2">[$247.50]</span>
  </div>
</div>

// Status indicator
<span className="terminal-status">[live]</span>

// Technical identifier
<span className="hex-address">t677x...uae</span>
```

## Implementation Guidelines

### CSS Architecture
```css
/* Pure terminal interface - dense and compact */
.terminal-pure {
  @apply bg-black border border-white/30 font-mono text-sm p-3 leading-tight;
}

.terminal-row {
  @apply flex justify-between items-center py-0.5;
}

.terminal-section {
  @apply border-t border-white/30 mt-2 pt-1;
}

.terminal-header {
  @apply font-mono font-bold text-white mb-1 text-sm uppercase;
}

.terminal-prompt {
  @apply text-pink-500;
}

.terminal-label {
  @apply text-gray-400 text-xs;
}

.terminal-value {
  @apply text-white text-sm;
}

.terminal-primary {
  @apply text-lime-500 font-bold text-sm;
}

.terminal-accent {
  @apply text-gray-600 text-xs;
}

.terminal-status {
  @apply text-pink-500 text-xs uppercase;
}

.hex-address {
  @apply font-mono text-cyan-400 text-xs;
}
```

### React Component Standards
- Single responsibility principle
- Minimal props interface
- Consolidated state management
- No unnecessary re-renders
- Clean, readable JSX structure

### File Organization
```
components/
├── terminal/
│   ├── TerminalInterface.tsx    // Main consolidated component
│   ├── TerminalRow.tsx          // Reusable row component
│   └── TerminalSection.tsx      // Reusable section component
```

## Quality Checklist

### Before Adding New Components
1. ✅ Can this be consolidated with existing components?
2. ✅ Are utility classes being reused?
3. ✅ Is the color usage minimal and purposeful?
4. ✅ Does it follow terminal naming conventions?
5. ✅ Is the code as minimal as possible?
6. ✅ Does it maintain pure black background?
7. ✅ Are spacing values consistent?

### Code Review Standards
- No decorative elements
- Minimal CSS classes per element
- Consistent monospace typography
- Strategic color usage only
- Dense information layout
- Clean component structure

## Anti-Patterns to Avoid

```tsx
// ❌ Avoid: Complex styling
className="bg-gray-900/95 backdrop-blur-sm rounded-3xl border border-pink-900/30 hover:border-pink-600/40 transition-all duration-300 shadow-lg shadow-pink-500/5"

// ✅ Use: Simple utility
className="terminal-pure"

// ❌ Avoid: Excessive colors
<span className="text-green-400 bg-green-900/20 border border-green-500/30 px-2 py-1 rounded">

// ✅ Use: Minimal styling
<span className="terminal-primary">

// ❌ Avoid: Multiple similar components
<PrimaryBalanceCard />
<SecondaryBalanceCard />

// ✅ Use: Consolidated component
<BalanceSection />
```

## Maintenance Philosophy

This design system prioritizes long-term maintainability through:

1. **Minimal CSS**: Fewer classes to maintain
2. **Consolidated Components**: Less duplication
3. **Clear Patterns**: Consistent implementation
4. **Pure Functions**: Predictable behavior
5. **Strategic Colors**: Easy to update

---

*"Clean code is not written by following a set of rules. Clean code is written by programmers who think about what they're doing."*