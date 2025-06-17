import { getCacheMetrics } from '@/utils/cacheManager';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private enabled: boolean = true;

  constructor() {
    // Enable performance monitoring in development
    this.enabled = process.env.NODE_ENV === 'development';
  }

  /**
   * Start tracking a performance metric
   */
  startMetric(name: string): void {
    if (!this.enabled) return;

    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      status: 'pending'
    });

    console.log(`[Performance] Started: ${name}`);
  }

  /**
   * End tracking a performance metric
   */
  endMetric(name: string, status: 'success' | 'error' = 'success', error?: string): void {
    if (!this.enabled) return;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`[Performance] No metric found for: ${name}`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    this.metrics.set(name, {
      ...metric,
      endTime,
      duration,
      status,
      error
    });

    const statusEmoji = status === 'success' ? '✅' : '❌';
    console.log(
      `[Performance] ${statusEmoji} ${name}: ${duration.toFixed(2)}ms`,
      error ? `(Error: ${error})` : ''
    );

    // Log slow operations
    if (duration > 1000) {
      console.warn(`[Performance] Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
    slowestOperation: PerformanceMetric | null;
  } {
    const metrics = this.getAllMetrics();
    const completedMetrics = metrics.filter(m => m.duration !== undefined);
    const successfulMetrics = completedMetrics.filter(m => m.status === 'success');
    const failedMetrics = completedMetrics.filter(m => m.status === 'error');

    const totalDuration = completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    const averageDuration = completedMetrics.length > 0 ? totalDuration / completedMetrics.length : 0;

    const slowestOperation = completedMetrics.reduce((slowest, current) => {
      if (!slowest || (current.duration || 0) > (slowest.duration || 0)) {
        return current;
      }
      return slowest;
    }, null as PerformanceMetric | null);

    return {
      totalOperations: metrics.length,
      successfulOperations: successfulMetrics.length,
      failedOperations: failedMetrics.length,
      averageDuration,
      slowestOperation
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Log summary to console
   */
  logSummary(): void {
    if (!this.enabled) return;

    const summary = this.getSummary();
    const cacheMetrics = getCacheMetrics();
    
    console.group('[Performance Summary]');
    console.log(`Total Operations: ${summary.totalOperations}`);
    console.log(`Successful: ${summary.successfulOperations}`);
    console.log(`Failed: ${summary.failedOperations}`);
    console.log(`Average Duration: ${summary.averageDuration.toFixed(2)}ms`);
    if (summary.slowestOperation) {
      console.log(
        `Slowest Operation: ${summary.slowestOperation.name} (${summary.slowestOperation.duration?.toFixed(2)}ms)`
      );
    }
    
    // Cache performance metrics
    console.log(`Cache Hit Rate: ${cacheMetrics.hitRate}%`);
    console.log(`Cache Hits: ${cacheMetrics.hits}`);
    console.log(`Cache Misses: ${cacheMetrics.misses}`);
    console.log(`Cache Invalidations: ${cacheMetrics.invalidations}`);
    
    console.groupEnd();
  }

  /**
   * Get combined performance and cache metrics
   */
  getFullMetrics() {
    return {
      performance: this.getSummary(),
      cache: getCacheMetrics()
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export convenience functions
export function trackThunk<T>(
  thunkName: string,
  promise: Promise<T>
): Promise<T> {
  performanceMonitor.startMetric(thunkName);
  
  return promise
    .then(result => {
      performanceMonitor.endMetric(thunkName, 'success');
      return result;
    })
    .catch(error => {
      performanceMonitor.endMetric(thunkName, 'error', error.message);
      throw error;
    });
}

// Add global logging for development
if (process.env.NODE_ENV === 'development') {
  // Log summary every 30 seconds
  setInterval(() => {
    performanceMonitor.logSummary();
  }, 30000);
}