# Swap Page Refactoring Plan

## Goal: Optimize swap page for better maintainability, performance, and code organization

---

## 🎯 **PHASE 1: State Management Cleanup**

### **1.1 Normalize swapSlice.ts**
- [ ] Remove duplicate state between swapSlice, primarySlice, and tokenomicsSlice
- [ ] Consolidate balance management into single normalized structure
- [ ] Create clean selectors for balance data
- [ ] Update thunks to use normalized state

### **1.2 Simplify State Structure**
- [ ] Merge redundant slices where it makes sense
- [ ] Remove unused state properties 
- [ ] Create typed interfaces for all state
- [ ] Optimize state updates to reduce re-renders

---

## 🎯 **PHASE 2: Component → Page Architecture**

### **2.1 Create Pages Directory**
- [ ] Create `/swap/pages/` folder
- [ ] Set up routing for each major function

### **2.2 Convert Components to Pages**
- [ ] **Balance Page** - `/swap/balance` - Overview of all balances
- [ ] **Swap Page** - `/swap/trade` - ICP → Secondary token  
- [ ] **Burn Page** - `/swap/burn` - Secondary → Primary + ICP
- [ ] **Stake Page** - `/swap/stake` - Stake primary tokens
- [ ] **Send Page** - `/swap/send` - Transfer tokens
- [ ] **Receive Page** - `/swap/receive` - Show addresses/QR codes
- [ ] **History Page** - `/swap/history` - Transaction history
- [ ] **Insights Page** - `/swap/insights` - Analytics/charts
- [ ] **Redeem Page** - `/swap/redeem` - Recover failed transactions

### **2.3 Page-Level Lazy Loading**
- [ ] Implement React.lazy() for each page
- [ ] Add loading states with Suspense
- [ ] Optimize bundle splitting

---

## 🎯 **PHASE 3: Shared Components**

### **3.1 Extract Common Balance Components**
- [ ] Create reusable `BalanceCard` component
- [ ] Build `TokenDisplay` component with logo/amount
- [ ] Create `RefreshButton` component
- [ ] Make `useBalance` hook for state management

### **3.2 Create Transaction Components**
- [ ] Build `TransactionRow` for history
- [ ] Create `ConfirmModal` for transactions
- [ ] Make `StatusIndicator` for tx status

---

## 🎯 **PHASE 4: Header Balance Integration**

### **4.1 Header Balance Component**
- [ ] Create compact balance display for header
- [ ] Show primary balance + USD value
- [ ] Add click to expand/collapse details
- [ ] Make it update when balances change

### **4.2 Balance Synchronization**
- [ ] Ensure balance updates everywhere when changed
- [ ] Share balance state between header and pages
- [ ] Add refresh functionality

---

## 🎯 **PHASE 5: Layout Improvements**

### **5.1 New Swap Layout**
- [ ] Create cleaner navigation between pages
- [ ] Improve mobile responsiveness  
- [ ] Add breadcrumbs for better navigation
- [ ] Make consistent spacing/styling

### **5.2 Performance Optimizations**
- [ ] Lazy load heavy components (charts, large lists)
- [ ] Optimize re-renders with proper memoization
- [ ] Reduce bundle size with code splitting

---

## 📋 **Simple Success Criteria**
- [ ] Less code overall (remove duplicates)
- [ ] Faster page switching (lazy loading)
- [ ] Cleaner file organization (pages vs components)
- [ ] Better mobile experience
- [ ] Balance shows in header properly

---

## ⏱️ **Estimated Timeline**
- **Phase 1**: 3-4 days (state cleanup)
- **Phase 2**: 5-7 days (page conversion) 
- **Phase 3**: 2-3 days (shared components)
- **Phase 4**: 2-3 days (header balance)
- **Phase 5**: 3-4 days (layout polish)

**Total: ~2-3 weeks**
