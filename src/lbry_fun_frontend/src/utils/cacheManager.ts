/**
 * Centralized cache management utility for Redux state
 * Provides TTL-based caching, cache keys based on pool ID, and cache invalidation
 */

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  poolId?: string;
}

export interface CacheableData<T = any> {
  data: T;
  lastFetch: number | null;
  poolId?: string;
}

export const CACHE_DURATIONS = {
  ICP_PRICE: 5 * 60 * 1000, // 5 minutes
  SECONDARY_RATIO: 30 * 1000, // 30 seconds (frequently changing)
  BALANCES: 10 * 1000, // 10 seconds (user-specific, changes with transactions)
  FEES: 60 * 1000, // 1 minute (rarely changes)
  STAKE_INFO: 30 * 1000, // 30 seconds (can change with rewards)
  TOTAL_STAKED: 60 * 1000, // 1 minute (aggregated data)
  AVERAGE_APY: 5 * 60 * 1000, // 5 minutes (calculated data)
  LOGS_DATA: 60 * 60 * 1000, // 1 hour (historical data)
  TRANSACTION_HISTORY: 30 * 1000, // 30 seconds (user activity)
} as const;

/**
 * Checks if cached data is still valid based on TTL
 */
export function isCacheValid(
  lastFetch: number | null,
  ttlMs: number,
  currentTime: number = Date.now()
): boolean {
  if (!lastFetch) return false;
  return (currentTime - lastFetch) < ttlMs;
}

/**
 * Creates a cache key from multiple parts
 */
export function createCacheKey(...parts: string[]): string {
  return parts.join(':');
}

/**
 * Checks if data should be fetched based on cache validity and pool context
 */
export function shouldFetchData(
  cacheEntry: CacheableData | null,
  ttlMs: number,
  currentPoolId?: string,
  currentTime: number = Date.now()
): boolean {
  // If no cached data exists, fetch
  if (!cacheEntry || !cacheEntry.lastFetch) return true;
  
  // If cache is expired, fetch
  if (!isCacheValid(cacheEntry.lastFetch, ttlMs, currentTime)) return true;
  
  // If pool-specific data exists but pool has changed, fetch
  if (cacheEntry.poolId && currentPoolId && cacheEntry.poolId !== currentPoolId) {
    return true;
  }
  
  return false;
}

/**
 * Updates cache entry with new data and timestamp
 */
export function updateCacheEntry<T>(
  data: T,
  poolId?: string,
  timestamp: number = Date.now()
): CacheableData<T> {
  return {
    data,
    lastFetch: timestamp,
    poolId,
  };
}

/**
 * Invalidates cache entries for a specific pool
 */
export function invalidatePoolCache<T extends Record<string, CacheableData>>(
  state: T,
  poolId: string
): T {
  const newState = { ...state };
  
  Object.keys(newState).forEach(key => {
    const cacheEntry = newState[key as keyof T];
    if (cacheEntry && cacheEntry.poolId === poolId) {
      (newState[key as keyof T] as CacheableData).lastFetch = null;
    }
  });
  
  return newState;
}

/**
 * Cleans up all expired cache entries
 */
export function cleanupExpiredCache<T extends Record<string, CacheableData>>(
  state: T,
  cacheDurations: Record<string, number>,
  currentTime: number = Date.now()
): T {
  const newState = { ...state };
  
  Object.keys(newState).forEach(key => {
    const cacheEntry = newState[key as keyof T];
    const ttl = cacheDurations[key];
    
    if (cacheEntry && cacheEntry.lastFetch && ttl) {
      if (!isCacheValid(cacheEntry.lastFetch, ttl, currentTime)) {
        (newState[key as keyof T] as CacheableData).lastFetch = null;
      }
    }
  });
  
  return newState;
}

/**
 * Cache performance monitoring
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  invalidations: number;
  lastCleanup: number;
}

let cacheMetrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  lastCleanup: Date.now(),
};

export function recordCacheHit(): void {
  cacheMetrics.hits++;
}

export function recordCacheMiss(): void {
  cacheMetrics.misses++;
}

export function recordCacheInvalidation(): void {
  cacheMetrics.invalidations++;
}

export function getCacheMetrics(): CacheMetrics & { hitRate: number } {
  const total = cacheMetrics.hits + cacheMetrics.misses;
  const hitRate = total > 0 ? (cacheMetrics.hits / total) * 100 : 0;
  
  return {
    ...cacheMetrics,
    hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
  };
}

export function resetCacheMetrics(): void {
  cacheMetrics = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    lastCleanup: Date.now(),
  };
}

/**
 * Development-only cache monitoring
 */
export function logCacheMetrics(): void {
  if (process.env.NODE_ENV === 'development') {
    const metrics = getCacheMetrics();
    console.log('Cache Performance Metrics:', {
      hitRate: `${metrics.hitRate}%`,
      hits: metrics.hits,
      misses: metrics.misses,
      invalidations: metrics.invalidations,
    });
  }
}

// Auto-log cache metrics every 5 minutes in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const metrics = getCacheMetrics();
    if (metrics.hits > 0 || metrics.misses > 0) {
      logCacheMetrics();
    }
  }, 5 * 60 * 1000);
}