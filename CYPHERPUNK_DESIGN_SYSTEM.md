# Cypherpunk Design System for LBRY.fun

## Overview
This design system embodies the cypherpunk ethos for LBRY.fun's token launchpad, targeting hackers, developers, and technical crypto enthusiasts who appreciate terminal aesthetics and functional minimalism.

## Design Philosophy

### Core Principles
1. **Terminal-First**: Every element references command-line interfaces
2. **Function Over Form**: Clean, readable, purposeful design
3. **Technical Language**: Speak directly to developers using their conventions
4. **Subtle Rebellion**: Electric colors against pure black - sharp but not flashy
5. **Genius Minimalism**: Maximum impact with minimum code - every line serves a purpose
6. **Cryptographic Aesthetic**: Hex addresses, terminal symbols, and clean data streams

### Target User
- Developers who live in terminals
- Crypto natives who understand technical details
- Tinkerers who appreciate seeing "under the hood"
- Users who value transparency and technical accuracy

## Visual Language

### Typography
```css
/* Primary Font Family */
font-family: 'Courier New', Courier, monospace; /* via Tailwind's font-mono */

/* Text Hierarchy */
.header-primary { @apply text-2xl font-mono font-bold; }
.header-secondary { @apply text-lg font-mono; }
.data-value { @apply font-mono; }
.label { @apply font-mono text-sm; }
```

### Color Palette

```css
/* Enhanced Core Colors */
--electric-green: #39ff14;  /* Primary values, success states - more electric */
--cyber-lime: #84cc16;      /* Secondary success states */
--toxic-pink: #ff0080;      /* Primary accents, live states - sharper */
--cyber-pink: #ec4899;      /* Secondary accents */
--terminal-gray: #0a0a0a;   /* Deeper background - more noir */
--data-gray: #888888;       /* Secondary information - more neutral */
--label-gray: #555555;      /* Subtle labels - sharper contrast */
--code-blue: #00d4ff;       /* Code highlights, status indicators */

/* Functional Colors */
--error: #ff2020;           /* Error states - more electric */
--warning: #ffaa00;         /* Warning states */
--success: var(--electric-green);
--connected: var(--toxic-pink);
--live: var(--electric-green);
```

### Naming Conventions

All UI labels follow terminal/programming conventions:

```
SECTION_HEADERS        // All caps with underscores
subsection_names       // Lowercase with underscores
[STATUS_INDICATORS]    // Bracketed states
> terminal_prompts     // Angle bracket prefixes
key_name:             // Colon-suffixed labels
```

## Component Patterns

### Minimal Terminal Effects
```css
/* Subtle scan lines for CRT effect */
.terminal-scanlines::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(transparent 50%, rgba(57, 255, 20, 0.02) 50%);
  background-size: 100% 2px;
  pointer-events: none;
}

/* Sharp electric glow for key data */
.cyber-glow {
  text-shadow: 0 0 8px currentColor;
}
```

### Card Containers - Simplified
```tsx
className="bg-black/90 backdrop-blur border border-zinc-800 
           hover:border-pink-600/60 transition-colors duration-200 
           shadow-lg shadow-pink-500/5 rounded-2xl p-6 
           relative terminal-scanlines"
```

### Status Indicators - Electric & Minimal
```tsx
// Connected State - Sharp pink
<span className="font-mono text-pink-400 animate-pulse cyber-glow">[CONNECTED]</span>

// Live State - Electric green
<span className="font-mono text-green-400 animate-pulse cyber-glow">[LIVE]</span>

// Percentage - Code blue
<span className="font-mono text-xs text-cyan-400">[42%]</span>
```

### Data Display - Enhanced Contrast
```tsx
// Primary Value - Electric green with glow
<span className="font-mono text-green-400 font-bold cyber-glow">24.7505</span>

// USD Conversion - Sharp pink
<span className="font-mono text-xs text-pink-400">[$247.51]</span>

// Secondary Value - Clean gray
<span className="font-mono text-gray-300">442,516</span>

// Hex displays for addresses
<span className="font-mono text-cyan-300">0xd4f2...563a</span>
```

### Interactive Elements
```tsx
// Hover States
className="text-pink-600 hover:text-pink-400 transition-colors cursor-pointer"

// Clickable Elements  
className="opacity-60 hover:opacity-100 transition-opacity"
```

## Layout Guidelines

### Information Hierarchy
1. **Section Headers**: Terminal prompts with descriptive names
2. **Primary Data**: Large, green, prominent positioning
3. **Secondary Data**: Smaller, gray, supporting information
4. **Metadata**: Subtle labels with colons

### Spacing System
- Use consistent padding based on terminal character grid
- Maintain visual rhythm with monospace alignment
- Border separators for logical groupings

## Implementation Examples

### Account Display Pattern
```tsx
<div className="border-b border-pink-900/30 pb-3">
  <span className="font-mono text-green-300 text-lg">
    t677x...uae
  </span>
  <span className="font-mono text-pink-500 text-sm ml-2 animate-pulse">
    [CONNECTED]
  </span>
</div>
```

### Balance Display Pattern
```tsx
<div className="flex justify-between items-center">
  <span className="font-mono text-green-300">ICP:</span>
  <div className="text-right">
    <span className="font-mono text-green-400 font-bold">49.5015</span>
    <span className="font-mono text-xs text-pink-500 ml-2">[$495.02]</span>
  </div>
</div>
```

### Metrics Display Pattern
```tsx
<div className="space-y-3">
  <div className="flex justify-between">
    <span className="font-mono text-sm text-gray-500">max_supply:</span>
    <span className="font-mono text-green-400">21,000,000</span>
  </div>
</div>
```

## Extending the System

### New Component Checklist
1. Use monospace fonts throughout
2. Follow terminal naming conventions
3. Apply consistent color hierarchy
4. Include hover/active states
5. Add subtle animations for live data
6. Maintain technical accuracy in labels

### Animation Guidelines
- Pulse effects for live/connected states
- Smooth transitions (300ms) for hover states
- No excessive motion - keep it subtle
- Performance over polish

### Responsive Considerations
- Preserve monospace grid alignment
- Maintain readability on small screens
- Keep terminal aesthetic across all breakpoints
- Prioritize data density for power users

## Color Usage Matrix

| Element Type | Primary Color | Accent Color | Text Color |
|-------------|--------------|--------------|------------|
| User Assets | cyber-lime | - | green-400 |
| System Status | - | cyber-pink | pink-500 |
| Headers | data-gray | cyber-pink (prompt) | gray-300 |
| Labels | - | - | gray-500 |
| Values | cyber-lime/data-gray | - | green-400/gray-300 |
| Borders | - | cyber-pink | pink-900/30 |
| Shadows | - | cyber-pink | rgba(236,72,153,0.15) |

## Code Examples

### Complete Card Component
```tsx
<div className="bg-gray-900/95 backdrop-blur-sm rounded-3xl 
                border border-pink-900/30 hover:border-pink-600/40 
                transition-all duration-300 p-10"
     style={{ 
       backgroundImage: 'url("images/gradient-bg.png")', 
       backgroundBlendMode: 'multiply', 
       backgroundColor: 'rgba(131,24,67,0.05)' 
     }}>
  <h4 className="text-2xl font-mono font-bold mb-6 text-gray-300">
    <span className="text-pink-500">&gt;</span> SECTION_NAME
  </h4>
  {/* Content */}
</div>
```

### Data Row Component
```tsx
<div className="flex justify-between items-center mb-2">
  <span className="font-mono text-sm text-gray-500">metric_name:</span>
  <div className="text-right">
    <span className="font-mono text-green-400">1,234,567</span>
    <span className="font-mono text-xs text-pink-500 ml-2">[56%]</span>
  </div>
</div>
```

## Updated Utility Classes (2025-06-24)

### Genius-Level Minimalism Implementation

The design system now includes streamlined utility classes that reduce code verbosity by ~70%:

```css
/* Core Components */
.terminal-card        /* Clean card container with scan lines */
.terminal-header      /* Consistent header styling */
.terminal-prompt      /* Pink > prompts */
.terminal-divider     /* ASCII-style section separators */

/* Data Display */
.data-row            /* Flex row for key-value pairs */
.data-label          /* Gray labels with colons */
.data-value          /* Standard data values */
.data-primary        /* Green primary values with glow */
.data-accent         /* Pink accent text (USD, percentages) */

/* Status & Effects */
.cyber-status        /* Animated status indicators */
.cyber-glow          /* Subtle text glow effect */
.hex-address         /* Cyan hex addresses */
.section-header      /* Consistent section headers */
```

### Code Reduction Example

**Before (verbose):**
```tsx
<div className="bg-gray-900/95 backdrop-blur-sm rounded-3xl border border-pink-900/30 hover:border-pink-600/40 transition-all duration-300 shadow-lg p-6">
```

**After (minimal):**
```tsx
<div className="terminal-card">
```

This approach achieves maximum visual impact with minimum code complexity - the hallmark of genius-level engineering.

## Maintenance Notes

1. **Consistency**: Always reference this guide when adding new components
2. **Evolution**: Update this document when introducing new patterns
3. **Testing**: Verify all colors meet WCAG AA contrast requirements
4. **Performance**: Minimize animation impact on lower-end devices
5. **Accessibility**: Ensure monospace fonts don't harm readability

---

*"In cryptography we trust, in terminals we build."*