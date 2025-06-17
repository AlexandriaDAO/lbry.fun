import {
  shouldFetchData,
  recordCacheHit,
  recordCacheMiss,
  recordCacheInvalidation,
  getCacheMetrics,
  resetCacheMetrics,
  createCacheKey,
  updateCacheEntry,
  CACHE_DURATIONS,
  CacheableData
} from '../../lbry_fun_frontend/src/utils/cacheManager';

describe('Cache Manager', () => {
  beforeEach(() => {
    resetCacheMetrics();
    jest.clearAllMocks();
  });

  describe('shouldFetchData', () => {
    const mockCacheEntry: CacheableData<string> = {
      data: '100',
      lastFetch: Date.now() - 10000, // 10 seconds ago
      poolId: '1'
    };

    test('returns false when cache is valid and pool matches', () => {
      const result = shouldFetchData(
        mockCacheEntry,
        30000, // 30 second TTL
        '1'
      );
      expect(result).toBe(false);
    });

    test('returns true when cache is expired', () => {
      const expiredEntry: CacheableData<string> = {
        data: '100',
        lastFetch: Date.now() - 40000, // 40 seconds ago
        poolId: '1'
      };
      const result = shouldFetchData(
        expiredEntry,
        30000, // 30 second TTL
        '1'
      );
      expect(result).toBe(true);
    });

    test('returns true when pool ID differs', () => {
      const result = shouldFetchData(
        mockCacheEntry,
        30000,
        '2' // Different pool
      );
      expect(result).toBe(true);
    });

    test('returns true when no cache entry exists', () => {
      const result = shouldFetchData(
        null,
        30000,
        '1'
      );
      expect(result).toBe(true);
    });

    test('returns true when lastFetch is null', () => {
      const noFetchEntry: CacheableData<string> = {
        data: '100',
        lastFetch: null,
        poolId: '1'
      };
      const result = shouldFetchData(
        noFetchEntry,
        30000,
        '1'
      );
      expect(result).toBe(true);
    });

    test('respects exact TTL boundary', () => {
      const now = Date.now();
      const boundaryEntry: CacheableData<string> = {
        data: '100',
        lastFetch: now - 30000, // Exactly 30 seconds ago
        poolId: '1'
      };
      
      // Mock Date.now to control timing
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => now);
      
      const result = shouldFetchData(
        boundaryEntry,
        30000,
        '1'
      );
      
      // Should be expired at exact boundary
      expect(result).toBe(true);
      
      Date.now = originalDateNow;
    });

    test('handles millisecond precision correctly', () => {
      const now = Date.now();
      const validEntry: CacheableData<string> = {
        data: '100',
        lastFetch: now - 29999, // 1ms before expiry
        poolId: '1'
      };
      
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => now);
      
      const result = shouldFetchData(
        validEntry,
        30000,
        '1'
      );
      
      // Should still be valid
      expect(result).toBe(false);
      
      Date.now = originalDateNow;
    });
  });

  describe('Cache Metrics', () => {
    test('records cache hits correctly', () => {
      recordCacheHit();
      recordCacheHit();
      recordCacheHit();
      
      const metrics = getCacheMetrics();
      expect(metrics.hits).toBe(3);
      expect(metrics.misses).toBe(0);
      expect(metrics.hitRate).toBe(100);
    });

    test('records cache misses correctly', () => {
      recordCacheMiss();
      recordCacheMiss();
      
      const metrics = getCacheMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(2);
      expect(metrics.hitRate).toBe(0);
    });

    test('calculates hit rate correctly with mixed hits and misses', () => {
      recordCacheHit();
      recordCacheHit();
      recordCacheMiss();
      
      const metrics = getCacheMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBeCloseTo(66.67, 2);
    });

    test('records cache invalidations', () => {
      recordCacheInvalidation();
      recordCacheInvalidation();
      
      const metrics = getCacheMetrics();
      expect(metrics.invalidations).toBe(2);
    });

    test('handles empty metrics (no hits or misses)', () => {
      const metrics = getCacheMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.hitRate).toBe(0);
      expect(metrics.invalidations).toBe(0);
    });

    test('resets metrics correctly', () => {
      recordCacheHit();
      recordCacheMiss();
      recordCacheInvalidation();
      
      resetCacheMetrics();
      
      const metrics = getCacheMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.invalidations).toBe(0);
      expect(metrics.hitRate).toBe(0);
    });
  });

  describe('createCacheKey', () => {
    test('creates consistent cache keys', () => {
      const key1 = createCacheKey('swap', 'balance', 'user123');
      const key2 = createCacheKey('swap', 'balance', 'user123');
      expect(key1).toBe(key2);
      expect(key1).toBe('swap:balance:user123');
    });

    test('handles different argument counts', () => {
      expect(createCacheKey('swap')).toBe('swap');
      expect(createCacheKey('swap', 'balance')).toBe('swap:balance');
      expect(createCacheKey('a', 'b', 'c', 'd')).toBe('a:b:c:d');
    });

    test('handles special characters in keys', () => {
      const key = createCacheKey('swap', 'user:test', 'pool:1');
      expect(key).toBe('swap:user:test:pool:1');
    });
  });

  describe('updateCacheEntry', () => {
    test('updates cache entry with current timestamp and pool', () => {
      const now = Date.now();
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => now);
      
      const result = updateCacheEntry('newData', '2');
      
      expect(result).toEqual({
        data: 'newData',
        lastFetch: now,
        poolId: '2'
      });
      
      Date.now = originalDateNow;
    });

    test('handles different data types', () => {
      const objectData = { value: 100, status: 'active' };
      const result = updateCacheEntry(objectData, '1');
      
      expect(result.data).toEqual(objectData);
      expect(result.poolId).toBe('1');
      expect(typeof result.lastFetch).toBe('number');
    });
  });

  describe('CACHE_DURATIONS', () => {
    test('has correct duration values', () => {
      expect(CACHE_DURATIONS.ICP_PRICE).toBe(5 * 60 * 1000); // 5 minutes
      expect(CACHE_DURATIONS.SECONDARY_RATIO).toBe(30 * 1000); // 30 seconds
      expect(CACHE_DURATIONS.BALANCES).toBe(10 * 1000); // 10 seconds
      expect(CACHE_DURATIONS.FEES).toBe(60 * 1000); // 1 minute
      expect(CACHE_DURATIONS.STAKE_INFO).toBe(30 * 1000); // 30 seconds
      expect(CACHE_DURATIONS.TOTAL_STAKED).toBe(60 * 1000); // 1 minute
      expect(CACHE_DURATIONS.AVERAGE_APY).toBe(5 * 60 * 1000); // 5 minutes
      expect(CACHE_DURATIONS.LOGS_DATA).toBe(60 * 60 * 1000); // 1 hour
      expect(CACHE_DURATIONS.TRANSACTION_HISTORY).toBe(30 * 1000); // 30 seconds
    });

    test('all durations are positive numbers', () => {
      Object.values(CACHE_DURATIONS).forEach(duration => {
        expect(duration).toBeGreaterThan(0);
        expect(typeof duration).toBe('number');
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles very old cache entries', () => {
      const veryOldEntry: CacheableData<string> = {
        data: 'old',
        lastFetch: new Date('2020-01-01').getTime(),
        poolId: '1'
      };
      
      const result = shouldFetchData(veryOldEntry, 30000, '1');
      expect(result).toBe(true);
    });

    test('handles future timestamps gracefully', () => {
      const futureEntry: CacheableData<string> = {
        data: 'future',
        lastFetch: Date.now() + 10000, // 10 seconds in future
        poolId: '1'
      };
      
      // Should treat future timestamps as valid cache
      const result = shouldFetchData(futureEntry, 30000, '1');
      expect(result).toBe(false);
    });

    test('handles zero TTL', () => {
      const entry: CacheableData<string> = {
        data: 'test',
        lastFetch: Date.now(),
        poolId: '1'
      };
      
      // Zero TTL means always fetch
      const result = shouldFetchData(entry, 0, '1');
      expect(result).toBe(true);
    });

    test('handles negative TTL as always fetch', () => {
      const entry: CacheableData<string> = {
        data: 'test',
        lastFetch: Date.now(),
        poolId: '1'
      };
      
      const result = shouldFetchData(entry, -1000, '1');
      expect(result).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    test('cache metrics calculation is fast', () => {
      // Record many hits and misses
      for (let i = 0; i < 10000; i++) {
        if (i % 3 === 0) recordCacheMiss();
        else recordCacheHit();
      }
      
      const start = performance.now();
      const metrics = getCacheMetrics();
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(1); // Should be sub-millisecond
      expect(metrics.hits).toBeCloseTo(6667, -1);
      expect(metrics.misses).toBeCloseTo(3333, -1);
    });

    test('shouldFetchData is performant', () => {
      const entry: CacheableData<string> = {
        data: 'test',
        lastFetch: Date.now() - 5000,
        poolId: '1'
      };
      
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        shouldFetchData(entry, 30000, '1');
      }
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(10); // 10,000 calls in under 10ms
    });
  });
});