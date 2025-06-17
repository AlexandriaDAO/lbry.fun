import { Middleware } from '@reduxjs/toolkit';

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

const CACHE_DURATION = 10000; // 10 seconds for effective deduplication
const pendingRequests = new Map<string, PendingRequest>();

/**
 * Middleware to prevent duplicate API requests
 * Deduplicates requests based on action type and payload
 */
export const requestDeduplicationMiddleware: Middleware = store => next => action => {
  // Only process thunk actions (they have a pending suffix)
  if (!action.type?.endsWith('/pending')) {
    return next(action);
  }
  
  // Special handling for thunks that shouldn't be deduplicated
  const neverDeduplicateActions = [
    'swap/swapSecondary',
    'swap/burnSecondary',
    'swap/stakePrimary',
    'swap/transferSecondary'
  ];
  
  if (neverDeduplicateActions.some(actionType => action.type.startsWith(actionType))) {
    return next(action);
  }

  // Generate a unique key for this request
  const key = generateRequestKey(action);
  
  // Check if we have a pending request for this key
  const pendingRequest = pendingRequests.get(key);
  
  if (pendingRequest) {
    const now = Date.now();
    const isExpired = now - pendingRequest.timestamp > CACHE_DURATION;
    
    if (!isExpired) {
      // Request is still pending or recently completed, skip this duplicate
      console.log(`[Deduplication] 🚫 Skipping duplicate request: ${action.type} (key: ${key})`);
      // For Redux Toolkit async thunks, we need to return nothing to skip the action
      // The original thunk will handle the fulfilled/rejected actions
      console.log(`[Deduplication] 📊 Stats: ${pendingRequests.size} pending requests in cache`);
      return;
    } else {
      // Clean up expired request
      console.log(`[Deduplication] 🧹 Cleaning up expired request: ${action.type} (key: ${key})`);
      pendingRequests.delete(key);
    }
  }

  // Process the action and store it in our deduplication cache
  console.log(`[Deduplication] ✅ Processing request: ${action.type} (key: ${key})`);
  
  // Store the request immediately to prevent race conditions
  pendingRequests.set(key, {
    promise: Promise.resolve(), // Placeholder, we don't have access to the actual promise
    timestamp: Date.now()
  });
  
  // Clean up after cache duration
  setTimeout(() => {
    pendingRequests.delete(key);
    console.log(`[Deduplication] 🧹 Auto-cleaned expired request: ${key}`);
  }, CACHE_DURATION);
  
  // Pass the action through
  return next(action);
};

/**
 * Generate a unique key for the request based on action type and payload
 */
function generateRequestKey(action: any): string {
  const baseKey = action.type.replace('/pending', '');
  
  // Handle different thunk patterns
  if (action.meta?.arg) {
    // Redux Toolkit createAsyncThunk pattern
    const arg = action.meta.arg;
    
    // Special cases for common thunks
    if (baseKey.includes('getIcpPrice')) {
      return `${baseKey}:global`; // ICP price is global, no args needed
    }
    
    if (baseKey.includes('Balance') && typeof arg === 'string') {
      return `${baseKey}:${arg}`; // Balance requests keyed by principal
    }
    
    if (typeof arg === 'object' && arg.userPrincipal) {
      return `${baseKey}:${arg.userPrincipal}`;
    }
    
    // Default: stringify the argument
    return `${baseKey}:${JSON.stringify(arg)}`;
  }
  
  return baseKey;
}

/**
 * Clear all pending requests (useful for cleanup)
 */
export function clearPendingRequests() {
  pendingRequests.clear();
}