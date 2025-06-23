import { performanceMonitor } from '../../lbry_fun_frontend/src/features/swap/utils/performanceMonitor';

describe('Swap Page Performance Benchmarks', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  
  beforeAll(() => {
    // Enable performance monitoring for tests
    process.env.NODE_ENV = 'development';
  });
  
  afterAll(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    performanceMonitor.clear(); // Clear metrics before each test
    // Force enable the performance monitor for tests since the singleton 
    // was already created with the wrong NODE_ENV
    (performanceMonitor as any).enabled = true;
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
      
      const allMetrics = performanceMonitor.getAllMetrics();
      const metric = allMetrics.find(m => m.name === metricName);
      
      expect(metric).toBeDefined();
      expect(metric?.status).toBe('success');
      expect(metric?.duration).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(metric?.duration).toBeLessThan(150);
    });

    test('calculates summary correctly', () => {
      const metricName = 'multiCall';
      
      // Run multiple operations
      for (let i = 0; i < 3; i++) {
        performanceMonitor.startMetric(`${metricName}_${i}`);
        
        const start = Date.now();
        while (Date.now() - start < 50) {
          // Busy wait for ~50ms
        }
        
        performanceMonitor.endMetric(`${metricName}_${i}`, 'success');
      }
      
      const summary = performanceMonitor.getSummary();
      
      expect(summary.totalOperations).toBe(3);
      expect(summary.successfulOperations).toBe(3);
      expect(summary.failedOperations).toBe(0);
      expect(summary.averageDuration).toBeGreaterThanOrEqual(40);
      expect(summary.averageDuration).toBeLessThan(70);
    });

    test('tracks error rates', () => {
      const metricName = 'errorProne';
      
      // 3 successes, 2 errors
      for (let i = 0; i < 5; i++) {
        performanceMonitor.startMetric(`${metricName}_${i}`);
        performanceMonitor.endMetric(`${metricName}_${i}`, i < 3 ? 'success' : 'error', 'Test error');
      }
      
      const summary = performanceMonitor.getSummary();
      
      expect(summary.totalOperations).toBe(5);
      expect(summary.successfulOperations).toBe(3);
      expect(summary.failedOperations).toBe(2);
    });

    test('clears metrics correctly', () => {
      performanceMonitor.startMetric('test1');
      performanceMonitor.endMetric('test1', 'success');
      
      expect(performanceMonitor.getAllMetrics().length).toBe(1);
      
      performanceMonitor.clear();
      
      expect(performanceMonitor.getAllMetrics().length).toBe(0);
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
      
      const allMetrics = performanceMonitor.getAllMetrics();
      const metric = allMetrics.find(m => m.name === 'loadCriticalData');
      expect(metric?.duration).toBeLessThan(400);
    });
  });

  // Note: This file previously contained cache-related tests, but cacheManager 
  // functionality was removed from the codebase
});