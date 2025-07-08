# Tokenomics Issues to Fix

## 1. Halving Rate Not Applied Correctly
**Problem**: When configured with 85% halving step, actual execution shows rates like 58% retention instead.
**Location**: `src/lbry_fun/src/update.rs` lines 108-125
**Issue**: Code incorrectly applies additional halvings to epochs without burn data

## 2. Preview Uses Artificial Epochs Instead of Thresholds
**Problem**: Preview function simulates specific burn patterns (30.1M, 30.1M, 60.2M, 120.4M...) but actual system uses cumulative thresholds
**Location**: `src/lbry_fun/src/tokenomics_simple.rs`
**Issue**: Conceptual mismatch between preview and reality

## 3. Early Supply Termination
**Problem**: System stops at 73.3% of max supply instead of reaching 100%
**Locati## 4. No Visibility Into Threshold Arrays
**Problem**: Cannot query the actual threshold and reward arrays stored in tokenomics canister
**Location**: `src/tokenomics/src/queries.rs`
**Issue**: Missing debug/query functions to inspect internal state
on**: Unknown - needs investigation
**Issue**: Possibly due to minimum reward floor or other stopping conditions

## 4. No Visibility Into Threshold Arrays
**Problem**: Cannot query the actual threshold and reward arrays stored in tokenomics canister
**Location**: `src/tokenomics/src/queries.rs`
**Issue**: Missing debug/query functions to inspect internal state

## 5. E8S vs Natural Units Confusion
**Problem**: Frontend sends some values in E8S, others in natural units, causing conversion errors
**Location**: Multiple files in token creation flow
**Issue**: Inconsistent unit handling between frontend and backend