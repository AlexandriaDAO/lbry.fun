import { performanceMonitor } from '../../lbry_fun_frontend/src/features/swap/utils/performanceMonitor';
import { shouldFetchData, recordCacheHit, recordCacheMiss, getCacheMetrics, updateCacheEntry, CacheableData } from '../../lbry_fun_frontend/src/utils/cacheManager';

describe('Swap Page Performance Benchmarks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Performance Monitor', () => {
    test('tracks metric timing accurately', () => {
      const metricName = 'testOperation';
      
      performanceMonitor.startMetric(metricName);
      
      // Simulate work
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Busy wait for ~100ms
      }
      
      performanceMonitor.endMetric(metricName, 'success');
      
      const metrics = performanceMonitor.getMetrics();
      const metric = metrics[metricName];
      
      expect(metric).toBeDefined();
      expect(metric.totalCalls).toBe(1);
      expect(metric.successCount).toBe(1);
      expect(metric.errorCount).toBe(0);
      expect(metric.averageDuration).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(metric.averageDuration).toBeLessThan(150);
    });

    test('calculates average duration correctly', () => {
      const metricName = 'multiCall';
      const durations = [50, 100, 150];
      
      durations.forEach(duration => {
        performanceMonitor.startMetric(metricName);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
          // Busy wait
        }
        
        performanceMonitor.endMetric(metricName, 'success');
      });
      
      const metrics = performanceMonitor.getMetrics();
      const metric = metrics[metricName];
      
      expect(metric.totalCalls).toBe(3);
      expect(metric.averageDuration).toBeGreaterThanOrEqual(90);
      expect(metric.averageDuration).toBeLessThan(110);
    });

    test('tracks slowest operation', () => {
      const operations = [
        { name: 'fast', duration: 10 },
        { name: 'slow', duration: 500 },
        { name: 'medium', duration: 100 }
      ];
      
      operations.forEach(({ name, duration }) => {
        performanceMonitor.startMetric(name);
        
        const start = Date.now();
        while (Date.now() - start < duration) {
          // Busy wait
        }
        
        performanceMonitor.endMetric(name, 'success');
      });
      
      const metrics = performanceMonitor.getMetrics();
      
      // Find slowest operation
      let slowestOp = '';
      let slowestTime = 0;
      
      Object.entries(metrics).forEach(([name, data]) => {
        if (data.averageDuration > slowestTime) {
          slowestTime = data.averageDuration;
          slowestOp = name;
        }
      });
      
      expect(slowestOp).toBe('slow');
      expect(slowestTime).toBeGreaterThanOrEqual(490);
    });

    test('handles concurrent metrics correctly', () => {
      const metric1 = 'concurrent1';
      const metric2 = 'concurrent2';
      
      performanceMonitor.startMetric(metric1);
      performanceMonitor.startMetric(metric2);
      
      // End in different order
      performanceMonitor.endMetric(metric2, 'success');
      performanceMonitor.endMetric(metric1, 'success');
      
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics[metric1]).toBeDefined();
      expect(metrics[metric2]).toBeDefined();
      expect(metrics[metric1].totalCalls).toBe(1);
      expect(metrics[metric2].totalCalls).toBe(1);
    });

    test('tracks error rates', () => {
      const metricName = 'errorProne';
      
      // 3 successes, 2 errors
      for (let i = 0; i < 5; i++) {
        performanceMonitor.startMetric(metricName);
        performanceMonitor.endMetric(metricName, i < 3 ? 'success' : 'error', 'Test error');
      }
      
      const metrics = performanceMonitor.getMetrics();
      const metric = metrics[metricName];
      
      expect(metric.totalCalls).toBe(5);
      expect(metric.successCount).toBe(3);
      expect(metric.errorCount).toBe(2);
      expect(metric.lastError).toBe('Test error');
    });
  });

  describe('Cache Performance Under Load', () => {
    test('cache operations scale linearly', () => {
      const testSizes = [100, 1000, 10000];
      const timings: number[] = [];
      
      testSizes.forEach(size => {
        const cacheEntries: CacheableData<string>[] = Array.from({ length: size }, (_, i) => ({
          data: `data${i}`,
          lastFetch: Date.now() - 5000,
          poolId: `pool${i % 10}`
        }));
        
        const start = performance.now();
        
        cacheEntries.forEach((entry, i) => {
          shouldFetchData(entry, 30000, `pool${i % 10}`);
        });
        
        const duration = performance.now() - start;
        timings.push(duration);
      });
      
      // Check that performance scales roughly linearly
      // 10x more operations should take ~10x more time (with some tolerance)
      const ratio1 = timings[1] / timings[0]; // 1000 vs 100
      const ratio2 = timings[2] / timings[1]; // 10000 vs 1000
      
      expect(ratio1).toBeGreaterThan(5); // At least 5x slower
      expect(ratio1).toBeLessThan(20); // But not more than 20x
      expect(ratio2).toBeGreaterThan(5);
      expect(ratio2).toBeLessThan(20);
    });

    test('cache hit tracking performance', () => {
      const iterations = 100000;
      
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        if (i % 3 === 0) {
          recordCacheMiss();
        } else {
          recordCacheHit();
        }
      }
      
      const metrics = getCacheMetrics();
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100); // 100k operations in under 100ms
      expect(metrics.hits + metrics.misses).toBe(iterations);
      expect(metrics.hitRate).toBeCloseTo(66.67, 1);
    });

    test('cache update performance', () => {
      const updates = 10000;
      const data = { value: 100, status: 'active' };
      
      const start = performance.now();
      
      for (let i = 0; i < updates; i++) {
        updateCacheEntry(data, `pool${i % 100}`);
      }
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50); // 10k updates in under 50ms
    });
  });

  describe('Simulated Page Load Performance', () => {
    test('loadCriticalData target: under 3 seconds', async () => {
      const criticalOperations = [
        { name: 'getSecondaryratio', delay: 200 },
        { name: 'getPrimaryMintRate', delay: 150 },
        { name: 'getSecondaryFee', delay: 100 },
        { name: 'getPrimaryFee', delay: 100 },
        { name: 'getIcpPrice', delay: 300 },
        { name: 'getCanisterBal', delay: 200 },
        { name: 'getCanisterArchivedBal', delay: 250 }
      ];
      
      performanceMonitor.startMetric('loadCriticalData');
      
      const start = Date.now();
      
      // Simulate parallel API calls
      await Promise.all(
        criticalOperations.map(op => 
          new Promise(resolve => setTimeout(resolve, op.delay))
        )
      );
      
      const totalTime = Date.now() - start;
      performanceMonitor.endMetric('loadCriticalData', 'success');
      
      // With parallel execution, should complete in ~300ms (slowest operation)
      expect(totalTime).toBeLessThan(400);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.loadCriticalData.averageDuration).toBeLessThan(400);
    });

    test('sequential vs parallel loading performance', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => ({
        name: `op${i}`,
        delay: 100
      }));
      
      // Sequential loading
      performanceMonitor.startMetric('sequential');
      const seqStart = Date.now();
      
      for (const op of operations) {
        await new Promise(resolve => setTimeout(resolve, op.delay));
      }
      
      const seqDuration = Date.now() - seqStart;
      performanceMonitor.endMetric('sequential', 'success');
      
      // Parallel loading
      performanceMonitor.startMetric('parallel');
      const parStart = Date.now();
      
      await Promise.all(
        operations.map(op => 
          new Promise(resolve => setTimeout(resolve, op.delay))
        )
      );
      
      const parDuration = Date.now() - parStart;
      performanceMonitor.endMetric('parallel', 'success');
      
      // Parallel should be ~5x faster for 5 operations
      expect(seqDuration).toBeGreaterThanOrEqual(490); // ~500ms
      expect(parDuration).toBeLessThan(150); // ~100ms
      expect(seqDuration / parDuration).toBeGreaterThan(3);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('performance monitor memory usage is bounded', () => {
      // Track memory before
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create many metrics
      for (let i = 0; i < 1000; i++) {
        const metricName = `metric${i}`;
        performanceMonitor.startMetric(metricName);
        performanceMonitor.endMetric(metricName, 'success');
      }
      
      // Check memory after
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should use less than 10MB for 1000 metrics
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      
      // Verify all metrics are tracked
      const metrics = performanceMonitor.getMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThanOrEqual(1000);
    });

    test('cache metrics memory usage is minimal', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many cache operations
      for (let i = 0; i < 100000; i++) {
        if (i % 2 === 0) {
          recordCacheHit();
        } else {
          recordCacheMiss();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Cache metrics should use minimal memory (just counters)
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB
      
      const metrics = getCacheMetrics();
      expect(metrics.hits + metrics.misses).toBe(100000);
    });
  });

  describe('Real-world Scenario Simulations', () => {
    test('rapid pool switching performance', async () => {
      const pools = ['pool1', 'pool2', 'pool3'];
      const switches = 20;
      
      performanceMonitor.startMetric('poolSwitching');
      
      for (let i = 0; i < switches; i++) {
        const poolId = pools[i % pools.length];
        
        // Simulate cache invalidation and data reload
        const cacheEntry: CacheableData<string> = {
          data: 'oldData',
          lastFetch: Date.now() - 60000, // 1 minute old
          poolId: pools[(i + 1) % pools.length] // Different pool
        };
        
        const shouldFetch = shouldFetchData(cacheEntry, 30000, poolId);
        expect(shouldFetch).toBe(true); // Should always fetch for different pool
        
        // Simulate data fetch
        await new Promise(resolve => setTimeout(resolve, 50));
        updateCacheEntry('newData', poolId);
      }
      
      performanceMonitor.endMetric('poolSwitching', 'success');
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.poolSwitching.averageDuration).toBeLessThan(1500); // 20 switches in < 1.5s
    });

    test('cache effectiveness over time', () => {
      const testDuration = 60000; // 1 minute
      const requestInterval = 100; // Request every 100ms
      const cacheTTL = 30000; // 30 second cache
      
      let cacheEntry: CacheableData<string> | null = null;
      let hits = 0;
      let misses = 0;
      
      const requests = testDuration / requestInterval;
      
      for (let i = 0; i < requests; i++) {
        const currentTime = i * requestInterval;
        
        if (shouldFetchData(cacheEntry, cacheTTL, 'pool1', currentTime)) {
          misses++;
          cacheEntry = {
            data: 'data',
            lastFetch: currentTime,
            poolId: 'pool1'
          };
        } else {
          hits++;
        }
      }
      
      const hitRate = (hits / (hits + misses)) * 100;
      
      // With 30s cache and 100ms requests, we expect high hit rate
      expect(hitRate).toBeGreaterThan(95); // Should be ~96.7%
      expect(misses).toBeLessThan(20); // Should have ~2 misses per minute
    });
  });

  describe('Target Performance Metrics', () => {
    test('all operations meet performance targets', () => {
      const performanceTargets = {
        shouldFetchData: 0.1, // 0.1ms per call
        recordCacheHit: 0.01, // 0.01ms per call
        updateCacheEntry: 0.1, // 0.1ms per call
        getCacheMetrics: 1, // 1ms per call
      };
      
      const iterations = 10000;
      
      // Test shouldFetchData
      const cacheEntry: CacheableData<string> = {
        data: 'test',
        lastFetch: Date.now() - 5000,
        poolId: 'pool1'
      };
      
      let start = performance.now();
      for (let i = 0; i < iterations; i++) {
        shouldFetchData(cacheEntry, 30000, 'pool1');
      }
      let avgTime = (performance.now() - start) / iterations;
      expect(avgTime).toBeLessThan(performanceTargets.shouldFetchData);
      
      // Test recordCacheHit
      start = performance.now();
      for (let i = 0; i < iterations; i++) {
        recordCacheHit();
      }
      avgTime = (performance.now() - start) / iterations;
      expect(avgTime).toBeLessThan(performanceTargets.recordCacheHit);
      
      // Test updateCacheEntry
      start = performance.now();
      for (let i = 0; i < iterations; i++) {
        updateCacheEntry('data', 'pool1');
      }
      avgTime = (performance.now() - start) / iterations;
      expect(avgTime).toBeLessThan(performanceTargets.updateCacheEntry);
      
      // Test getCacheMetrics
      start = performance.now();
      for (let i = 0; i < iterations; i++) {
        getCacheMetrics();
      }
      avgTime = (performance.now() - start) / iterations;
      expect(avgTime).toBeLessThan(performanceTargets.getCacheMetrics);
    });
  });
});