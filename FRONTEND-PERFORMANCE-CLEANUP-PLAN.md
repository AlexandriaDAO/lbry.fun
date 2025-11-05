# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/lbryfun" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/lbryfun-frontend-cleanup"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/lbryfun-frontend-cleanup`
2. **Implement feature** - Follow plan sections below
3. **Build locally** (verification only - NEVER DEPLOY TO MAINNET):
   ```bash
   npm run build
   ```
   **⚠️ PRODUCTION WARNING**: This is a live financial application. Never deploy to mainnet.
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Optimize frontend performance and remove unused dependencies"
   git push -u origin feature/frontend-performance-cleanup
   gh pr create --title "Performance: Remove unused dependencies and optimize bundle" --body "Implements FRONTEND-PERFORMANCE-CLEANUP-PLAN.md

## Changes
- Remove unused ebook reader libraries (jszip, md5, epub)
- Optimize webpack configuration for better bundle splitting
- Improve font loading strategy
- Fix source map configuration
- Reduce initial page load time

Fixes console errors and 503 responses on page load."
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

**Branch:** `feature/frontend-performance-cleanup`
**Worktree:** `/home/theseus/alexandria/lbryfun-frontend-cleanup`

---

# Implementation Plan: Frontend Performance Cleanup

## Task Classification
**REFACTORING**: Remove unused code and optimize existing implementation → subtractive + targeted fixes

## Current State Documentation

### File Tree (Affected Files)
```
src/lbry_fun_frontend/
├── public/
│   └── index.html                    # MODIFY - Remove ebook library script tags
├── src/
│   └── index.tsx                     # MODIFY - Optimize font loading
└── webpack.config.js                 # MODIFY - Optimize bundle configuration
```

### Issues Identified

#### 1. Unused Ebook Reader Libraries (HIGH PRIORITY)
**Location:** `src/lbry_fun_frontend/public/index.html:16-18`

```html
<script src="js/libs/jszip.min.js"></script>
<script src="js/libs/md5.min.js"></script>
<script src="js/libs/epub.min.js"></script>
```

**Problem:**
- These files don't exist in the project (404/503 errors)
- Not needed for a crypto token launchpad
- Causing console errors on every page load
- Blocking render unnecessarily

**Evidence from logs:**
```
Loading failed for the <script> with source "https://lbry.fun/js/libs/jszip.min.js"
GET https://lbry.fun/js/libs/md5.min.js [HTTP/2 503  222ms]
GET https://lbry.fun/js/libs/epub.min.js [HTTP/2 503  183ms]
```

#### 2. Source Map Errors
**Problem:**
- Multiple "JSON.parse: unexpected character" errors
- Missing source maps for React DevTools
- Creates console noise that makes debugging harder

**Evidence from logs:**
```
Source map error: JSON.parse: unexpected character at line 1 column 1
Resource URL: https://lbry.fun/%3Canonymous%20code%3E
Source Map URL: installHook.js.map
```

#### 3. Bundle Splitting Over-Optimization
**Location:** `webpack.config.js:36-85`

**Current configuration:**
- 11+ vendor chunk files
- maxInitialRequests: 6
- maxAsyncRequests: 30
- Multiple separate chunks for vendors, tensorflow, nsfwjs, etc.

**Problem:**
- Too many HTTP requests on initial load
- Over-granular splitting may hurt performance on modern HTTP/2
- Network overhead from multiple small files

**Evidence from logs:**
```
GET https://lbry.fun/vendors-7be6322b.89c697a6182d5e995064.js [HTTP/2 200  184ms]
GET https://lbry.fun/vendors-761c4b13.b90f44b094b7d1d999a0.js [HTTP/2 200  381ms]
... (11 total vendor files)
```

#### 4. Font Loading Strategy
**Location:** `src/lbry_fun_frontend/src/index.tsx:79-86`

**Current implementation:**
```javascript
WebFont.load({
    google: {
        families: ["Syne", "Roboto Condensed"],
    },
    active: () => {
        console.log("Fonts loaded");
    }
});
```

**Problem:**
- Blocking JavaScript execution for font loading
- External Google Fonts request (privacy concern)
- Could use font-display: swap for better performance
- No fallback strategy if font loading fails

#### 5. Webpack Source Map Configuration
**Location:** `webpack.config.js:26`

**Current:** `devtool: isDevelopment ? "source-map" : false`

**Problem:**
- Source maps disabled in production (good)
- But development source maps might be causing issues
- Consider using faster source map option for development

### Dependencies Analysis

**Current font dependencies:**
- `webfontloader: ^1.6.28` (package.json:149)
- Google Fonts: Syne, Roboto Condensed

**Unused references:**
- jszip.min.js (ebook archive handling)
- md5.min.js (hash generation for ebook files)
- epub.min.js (ebook reader)

**None of these are needed for a token launchpad application.**

---

## Implementation Plan (Pseudocode)

### 1. Remove Unused Ebook Reader Libraries

**File:** `src/lbry_fun_frontend/public/index.html` (MODIFY)

```html
<!-- PSEUDOCODE: Remove lines 16-18 completely -->

BEFORE:
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

    <script src="js/libs/jszip.min.js"></script>
    <script src="js/libs/md5.min.js"></script>
    <script src="js/libs/epub.min.js"></script>

    <!-- Critical CSS -->

AFTER:
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

    <!-- Critical CSS -->
```

**Impact:**
- Eliminates 3 failed HTTP requests on every page load
- Removes 503 errors from console
- Faster initial render (no blocking scripts)

### 2. Optimize Font Loading Strategy

**File:** `src/lbry_fun_frontend/public/index.html` (MODIFY)

Add optimized font loading with font-display swap:

```html
<!-- PSEUDOCODE: Add after preconnect links, before Critical CSS -->

<!-- Add direct link to Google Fonts with font-display swap -->
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Roboto+Condensed:wght@300;400;700&display=swap" rel="stylesheet" />
```

**File:** `src/lbry_fun_frontend/src/index.tsx` (MODIFY)

Remove WebFont.load() completely:

```javascript
// PSEUDOCODE

BEFORE:
import WebFont from "webfontloader";
// ... other code ...

WebFont.load({
    google: {
        families: ["Syne", "Roboto Condensed"],
    },
    active: () => {
        console.log("Fonts loaded");
    }
});

const container = document.getElementById("root");

AFTER:
// Remove WebFont import entirely

// ... other code (no WebFont.load() call) ...

const container = document.getElementById("root");
```

**File:** `package.json` (MODIFY)

```json
// PSEUDOCODE: Remove webfontloader dependency

BEFORE:
"dependencies": {
    // ... other deps ...
    "webfontloader": "^1.6.28"
}

AFTER:
"dependencies": {
    // ... other deps ...
    // webfontloader removed
}
```

**Impact:**
- Fonts load asynchronously with swap behavior (no FOUT)
- One less npm dependency
- Simpler, more maintainable code
- Better performance

### 3. Optimize Webpack Bundle Configuration

**File:** `webpack.config.js` (MODIFY)

```javascript
// PSEUDOCODE: Simplify splitChunks configuration

BEFORE:
optimization: {
    minimize: !isDevelopment,
    minimizer: [new TerserPlugin({...})],
    splitChunks: {
        chunks: 'all',
        maxInitialRequests: 6,
        maxAsyncRequests: 30,
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
            critical: { /* React/Redux */ },
            tensorflow: { /* TF packages */ },
            nsfwjs: { /* NSFWJS */ },
            vendors: { /* All vendors */ },
            commons: { /* Common code */ },
        },
    },
    runtimeChunk: 'single',
}

AFTER:
optimization: {
    minimize: !isDevelopment,
    minimizer: [new TerserPlugin({
        terserOptions: {
            compress: {
                drop_console: false,
            },
        },
    })],
    splitChunks: {
        chunks: 'all',
        maxInitialRequests: 3, // Reduced from 6
        cacheGroups: {
            // Combine React and critical UI libraries
            reactVendor: {
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|react-redux|@reduxjs\/toolkit)[\\/]/,
                name: 'react-vendor',
                priority: 40,
                enforce: true,
            },
            // Heavy async libraries (TensorFlow, NSFWJS)
            heavyLibs: {
                test: /[\\/]node_modules[\\/](@tensorflow|tfjs-core|tfjs-backend-.*|tfjs-converter|nsfwjs)[\\/]/,
                name: 'heavy-libs',
                chunks: 'async',
                priority: 30,
                enforce: true,
            },
            // IC and crypto dependencies
            icVendor: {
                test: /[\\/]node_modules[\\/](@dfinity|@noble|@scure)[\\/]/,
                name: 'ic-vendor',
                priority: 20,
                enforce: true,
            },
            // Other vendor code
            vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendor',
                priority: 10,
                reuseExistingChunk: true,
            },
        },
    },
    runtimeChunk: 'single',
}
```

**Impact:**
- Fewer initial HTTP requests (3 vs 6+)
- Better caching strategy with logical grouping
- React/Redux in one chunk (frequently used together)
- IC dependencies grouped (domain-specific)
- Heavy ML libraries stay async-loaded

### 4. Improve Development Source Maps

**File:** `webpack.config.js` (MODIFY)

```javascript
// PSEUDOCODE: Use faster source map for development

BEFORE:
devtool: isDevelopment ? "source-map" : false,

AFTER:
devtool: isDevelopment ? "eval-cheap-module-source-map" : false,
```

**Reasoning:**
- `eval-cheap-module-source-map` is much faster for development
- Still provides readable stack traces
- Better for iterative development
- Production keeps source maps disabled (security)

### 5. Add Console Cleanup

**File:** `src/lbry_fun_frontend/src/index.tsx` (MODIFY)

```javascript
// PSEUDOCODE: Remove unnecessary console.log in production

AFTER WebFont.load() REMOVAL:

// At the top of file
const isDevelopment = process.env.NODE_ENV !== 'production';

// Replace console.log with conditional
function removeLoadingIndicator() {
    const indicator = document.getElementById('app-loading-indicator');
    if (indicator) {
        indicator.classList.add('fade-out');
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
            // Only log in development
            if (isDevelopment) {
                console.log('Loading indicator removed');
            }
        }, 300);
    }
}
```

### 6. Update Preconnect Hints

**File:** `src/lbry_fun_frontend/public/index.html` (MODIFY)

```html
<!-- PSEUDOCODE: Keep preconnect, already optimized -->

<!-- These are good as-is -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

No changes needed - already optimal.

---

## Testing Requirements

### Local Build Verification
```bash
# Clean install dependencies
cd /home/theseus/alexandria/lbryfun-frontend-cleanup
npm install

# Build frontend
npm run build

# Verify no build errors
# Expected: Clean build with no warnings about missing libraries
```

### Manual Testing Checklist
1. **Page Load Performance**
   - Open browser DevTools Network tab
   - Navigate to application
   - Verify: No 503 errors for jszip/md5/epub
   - Verify: Fewer initial HTTP requests
   - Verify: Fonts load with swap behavior

2. **Console Cleanliness**
   - Open browser Console
   - Navigate to application
   - Verify: No errors about missing scripts
   - Verify: No source map errors (or significantly reduced)

3. **Functionality**
   - Test all main features still work:
     - Token list loading
     - Swap operations
     - Staking
     - Charts and analytics
   - Verify fonts render correctly (Syne, Roboto Condensed)

4. **Bundle Analysis (Optional)**
   - Uncomment BundleAnalyzerPlugin in webpack.config.js
   - Run `npm run build`
   - Review bundle composition
   - Verify chunks are logically organized

### Success Criteria
- ✅ No 503 errors in console
- ✅ No failed script loads
- ✅ Fonts render correctly
- ✅ Initial page load faster (measure with DevTools)
- ✅ All existing features work correctly
- ✅ Build completes without errors

### **CRITICAL**: No Mainnet Deployment
- **NEVER deploy to mainnet** - this is a production app with financial consequences
- Only test in local development environment
- Build verification only

---

## Rollback Plan

If issues are discovered:

1. **Immediate Rollback**
   ```bash
   git checkout main
   git worktree remove /home/theseus/alexandria/lbryfun-frontend-cleanup
   ```

2. **Partial Rollback**
   - If specific changes cause issues, revert individual files:
   ```bash
   git checkout origin/main -- <file-path>
   ```

---

## Expected Performance Improvements

### Before
- **Initial page load:** ~991ms + 11 vendor chunks
- **Console errors:** 3 failed script loads (503 errors)
- **HTTP requests:** ~14+ on initial load
- **Source map errors:** Multiple per session

### After
- **Initial page load:** Expected <800ms (20% improvement)
- **Console errors:** 0 failed script loads
- **HTTP requests:** ~7-9 on initial load (40% reduction)
- **Source map errors:** Eliminated or minimal

### Metrics to Track
- Time to First Contentful Paint (FCP)
- Time to Interactive (TTI)
- Total Blocking Time (TBT)
- Bundle size (should decrease slightly)

---

## Additional Notes

### Why These Libraries Were Present
These ebook reader libraries (jszip, md5, epub) likely came from:
1. Copy-paste from another project (possibly Alexandria project which handles books)
2. Initial template/boilerplate that wasn't cleaned up
3. Previous developer experimentation

### Why They're Safe to Remove
- Not referenced anywhere in the TypeScript/JavaScript code
- Not in package.json dependencies
- Pure HTML script tags that never load successfully
- Token launchpad has no ebook functionality

### Future Optimizations (Not in This PR)
- Consider self-hosting fonts for better privacy and reliability
- Implement service worker for caching
- Add resource hints (dns-prefetch, preload) for critical assets
- Consider using a CDN for static assets
- Implement lazy loading for heavy components

---

## Plan Checklist

- [x] Worktree created first
- [x] Orchestrator header EMBEDDED at top of plan
- [x] Current state documented
- [x] Implementation in pseudocode
- [x] Testing strategy defined
- [ ] Plan committed to feature branch
- [ ] Handoff command provided with PR creation reminder

---

**Plan prepared by:** Claude Code (Sonnet 4.5)
**Date:** 2025-11-05
**Worktree:** `/home/theseus/alexandria/lbryfun-frontend-cleanup`
**Branch:** `feature/frontend-performance-cleanup`
