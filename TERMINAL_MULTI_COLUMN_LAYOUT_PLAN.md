# Terminal Multi-Column Layout Plan

## Current State
- Terminals are displayed one at a time in a tabbed interface
- Each terminal uses container classes that limit width (terminal-container-md, terminal-container-lg, etc.)
- CSS already has grid classes but they're not being used for terminals

## Goal
Display multiple terminals side-by-side on desktop while maintaining single column on mobile

## Implementation Plan

### Option 1: Grid View Mode (Recommended)
Add a view toggle that allows users to switch between:
- Tab view (current behavior - one terminal at a time)
- Grid view (all terminals visible in columns)

### Option 2: Always Show All Terminals
Remove tab navigation and always show all terminals in a responsive grid

## Todo Items
- [ ] Add view mode toggle button to SwapMainConsolidated
- [ ] Create a grid container that holds all three terminals
- [ ] Modify terminal container classes to work well in grid layout
- [ ] Ensure responsive behavior (1 column mobile, 2-3 columns desktop)
- [ ] Test layout at various screen sizes
- [ ] Maintain terminal aesthetic and readability

## Technical Approach
1. Use existing `terminal-grid` classes with modifications
2. Create a new layout mode in SwapMainConsolidated
3. Conditionally render either tabbed view or grid view
4. Store view preference in localStorage