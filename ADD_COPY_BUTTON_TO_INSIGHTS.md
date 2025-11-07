# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-copy-graph-data"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-copy-graph-data`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   ./scripts/build.sh
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Add copy button to Insights graph for exporting data"
   git push -u origin feature/copy-graph-data
   gh pr create --title "Feature: Add copy button to Insights graph" --body "Implements ADD_COPY_BUTTON_TO_INSIGHTS.md"
   ```
5. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/copy-graph-data`
**Worktree:** `/home/theseus/alexandria/lbryfun-copy-graph-data`

---

# Implementation Plan

## Task Classification
**NEW FEATURE**: Adding a copy button to export Insights graph data

## Current State

### File Structure
```
src/lbry_fun_frontend/src/features/swap/components/
├── Insights.tsx                    # Main Insights component (MODIFY)
├── TokenomicsTab.tsx               # Reference implementation with copy button
├── Chart.tsx                       # Shared LineChart component
└── terminals/
    └── AnalyticsTerminal.tsx       # Container with tabs (insights/tokenomics/technical/treasury)
```

### Current Insights Component (Insights.tsx)

**Location:** `src/lbry_fun_frontend/src/features/swap/components/Insights.tsx`

**Current Implementation:**
- Lines 1-29: Imports, lazy loading Chart and DistributionTracker, utility functions
- Lines 30-47: Component setup, Redux hooks, useEffect for data fetching
- Lines 48-62: Summary data memoization
- Lines 64-101: Loading/error/empty states
- Lines 103-159: Latest metrics display (terminal-style summary card)
- Lines 161-215: Six LineChart graphs:
  1. Primary Token Supply (line 168)
  2. Secondary Token Supply (line 175)
  3. Total Secondary Burned (line 182)
  4. Total Primary Staked (line 189)
  5. Staker Count (line 196)
  6. Historical APY (line 204-212, conditional on insights.apy)
- Lines 217-233: Distribution tracking section
- **NO COPY BUTTON EXISTS**

**Data Structure:** The `insights` object from Redux state contains:
```typescript
{
  time: number[],                    // Timestamps
  primaryTokenSupply: number[],      // Supply data
  secondaryTokenSupply: number[],
  totalSecondaryBurned: number[],
  totalPrimaryStaked: number[],
  stakerCount: number[],
  apy?: number[],                    // Optional APY data
  hourlyIcpRewards: number[]
}
```

### Reference Implementation (TokenomicsTab.tsx)

**Location:** `src/lbry_fun_frontend/src/features/swap/components/TokenomicsTab.tsx`

**Copy Button Implementation:**
- Lines 19: State for copy success: `const [copySuccess, setCopySuccess] = useState(false);`
- Lines 119-133: `copyToClipboard` function:
  - Creates data object with poolId and all graph data
  - Uses `navigator.clipboard.writeText(JSON.stringify(chartData, null, 2))`
  - Shows success feedback for 2 seconds
- Lines 319-330: Copy button UI (terminal-style button)

## Implementation Plan

### File to Modify
**MODIFY:** `src/lbry_fun_frontend/src/features/swap/components/Insights.tsx`

### Changes Required

#### 1. Add State for Copy Success (After line 32)
```typescript
// PSEUDOCODE - Add after existing state hooks
const [copySuccess, setCopySuccess] = useState(false);
```

#### 2. Add Copy Function (After formatNumber function, before Insights component)
```typescript
// PSEUDOCODE - Add before component return
const copyToClipboard = () => {
    // Create structured data object
    const insightsData = {
        poolId: poolData?.[0]?.toString(),
        timestamp: new Date().toISOString(),
        graphs: {
            time: formattedTime,
            primaryTokenSupply: {
                xAxis: formattedTime,
                yAxis: insights.primaryTokenSupply
            },
            secondaryTokenSupply: {
                xAxis: formattedTime,
                yAxis: insights.secondaryTokenSupply
            },
            totalSecondaryBurned: {
                xAxis: formattedTime,
                yAxis: insights.totalSecondaryBurned
            },
            totalPrimaryStaked: {
                xAxis: formattedTime,
                yAxis: insights.totalPrimaryStaked
            },
            stakerCount: {
                xAxis: formattedTime,
                yAxis: insights.stakerCount
            },
            // Include APY if available
            ...(insights.apy && {
                historicalApy: {
                    xAxis: formattedTime,
                    yAxis: insights.apy
                }
            })
        },
        summary: summaryData
    };

    // Copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(insightsData, null, 2));

    // Show success feedback
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
};
```

#### 3. Add Copy Button UI (After line 215, before DistributionTracker section)
```tsx
// PSEUDOCODE - Add after the closing </Suspense> of the graphs grid
{/* Copy Graph Data Button */}
<div className="bg-black border border-white/30 p-3 font-mono mt-8">
    <div className="flex justify-between items-center py-0.5 justify-end">
        <button
            type="button"
            onClick={copyToClipboard}
            className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10 text-xs hover:bg-white/10 px-3 py-1 border border-white/30"
        >
            <span className="text-pink-500">&gt;</span> {copySuccess ? 'copied_to_clipboard' : 'copy_graph_data'}
        </button>
    </div>
</div>
```

### Detailed Implementation Steps

1. **Import useState** (if not already imported from React)
   - Location: Line 1
   - Change: Ensure `useState` is in React imports

2. **Add copySuccess state**
   - Location: After line 32 (after existing state declarations)
   - Add: `const [copySuccess, setCopySuccess] = useState(false);`

3. **Create copyToClipboard function**
   - Location: Inside the Insights component, after the `summaryData` useMemo (after line 62)
   - Implementation: Create function that structures all graph data and copies to clipboard

4. **Add copy button UI**
   - Location: After the graph grid's closing `</Suspense>` (after line 215)
   - Before the Distribution Tracker section (before line 217)
   - Styling: Match TokenomicsTab terminal-style button

### Expected Data Output Format
```json
{
  "poolId": "...",
  "timestamp": "2025-11-07T...",
  "graphs": {
    "time": ["11/1/2025", "11/2/2025", ...],
    "primaryTokenSupply": {
      "xAxis": [...],
      "yAxis": [...]
    },
    "secondaryTokenSupply": {
      "xAxis": [...],
      "yAxis": [...]
    },
    "totalSecondaryBurned": {
      "xAxis": [...],
      "yAxis": [...]
    },
    "totalPrimaryStaked": {
      "xAxis": [...],
      "yAxis": [...]
    },
    "stakerCount": {
      "xAxis": [...],
      "yAxis": [...]
    },
    "historicalApy": {
      "xAxis": [...],
      "yAxis": [...]
    }
  },
  "summary": {
    "primaryTokenSupply": 123456,
    "secondaryTokenSupply": 78910,
    ...
  }
}
```

## Testing Requirements

### Local Build Verification
```bash
# Build frontend to verify TypeScript compilation
./scripts/build.sh
```

**CRITICAL**:
- ✅ Verify no TypeScript errors
- ✅ Verify button appears below graphs
- ✅ Verify clicking button copies data
- ✅ Verify success feedback appears for 2 seconds
- ✅ Verify data structure matches expected format
- ❌ DO NOT deploy to mainnet

### Manual Testing Checklist
1. Navigate to token page → Analytics Terminal → Insights tab
2. Scroll to bottom of graphs section
3. Verify copy button appears with text "copy_graph_data"
4. Click button
5. Verify text changes to "copied_to_clipboard" for 2 seconds
6. Paste clipboard content
7. Verify JSON is properly formatted with all graph data
8. Verify includes poolId, timestamp, all 5-6 graphs, and summary data

## Constraints & Considerations

### Styling Consistency
- Match existing terminal-style buttons in the codebase
- Use same color scheme as TokenomicsTab copy button
- Terminal pink accent color: `text-pink-500`
- Border: `border-white/30`
- Hover state: `hover:bg-white/10`

### Data Integrity
- Include all available graph data (6 graphs total if APY exists)
- Include both formatted time (x-axis) and raw data arrays
- Include summary metrics for context
- Add timestamp for when data was exported
- Include poolId for traceability

### User Experience
- Success feedback must be clear and temporary (2 seconds)
- Button must be easily discoverable below graphs
- Copied data must be well-formatted JSON (pretty print with 2-space indent)

## Success Criteria

✅ Copy button appears below Insights graphs
✅ Button uses consistent terminal styling
✅ Clicking button copies all graph data to clipboard
✅ Success feedback displays for 2 seconds
✅ Copied data includes all 6 graphs (or 5 if no APY)
✅ JSON is properly formatted and parseable
✅ No TypeScript errors
✅ Matches TokenomicsTab implementation pattern
