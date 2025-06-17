/**
 * Cache warming utility for preloading frequently accessed data
 * Helps reduce perceived latency by proactively fetching data that users are likely to need
 */

import { AppDispatch, RootState } from "@/store";
import { CACHE_DURATIONS, shouldFetchData } from "./cacheManager";
import getSecondaryratio from "@/features/swap/thunks/getSecondaryratio";
import getSecondaryFee from "@/features/swap/thunks/secondaryIcrc/getSecondaryFee";
import getAverageApy from "@/features/swap/thunks/getAverageApy";
import getIcpPrice from "@/features/icp-ledger/thunks/getIcpPrice";
import { isUserAuthenticated } from "@/features/auth/utils/authUtils";

export interface CacheWarmingConfig {
  enableBackgroundRefresh: boolean;
  warmingIntervals: Record<string, number>;
  priorityThunks: string[];
}

const DEFAULT_CONFIG: CacheWarmingConfig = {
  enableBackgroundRefresh: true,
  warmingIntervals: {
    // High priority - refresh every 30 seconds
    secondaryRatio: 30 * 1000,
    icpPrice: 60 * 1000, // ICP price every minute
    averageAPY: 2 * 60 * 1000, // APY every 2 minutes
    
    // Medium priority - refresh every 5 minutes  
    secondaryFee: 5 * 60 * 1000,
    
    // Low priority - refresh every 10 minutes
    totalStaked: 10 * 60 * 1000,
  },
  priorityThunks: [
    'secondaryRatio',
    'icpPrice', 
    'averageAPY',
    'secondaryFee'
  ],
};

/**
 * Cache warming manager that preloads and refreshes critical data
 */
export class CacheWarmingManager {
  private dispatch: AppDispatch;
  private getState: () => RootState;
  private config: CacheWarmingConfig;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isActive: boolean = false;

  constructor(dispatch: AppDispatch, getState: () => RootState, config?: Partial<CacheWarmingConfig>) {
    this.dispatch = dispatch;
    this.getState = getState;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start cache warming for the current active pool
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.log('Cache warming already active');
      return;
    }

    const state = this.getState();
    if (!state.swap.activeSwapPool) {
      console.log('No active swap pool - skipping cache warming');
      return;
    }

    // Check authentication before starting cache warming for canister-dependent operations
    const isAuthenticated = await isUserAuthenticated();
    if (!isAuthenticated) {
      console.log('User not authenticated - skipping cache warming for canister operations');
      // Only warm public data (ICP price) if not authenticated
      this.warmPublicDataOnly();
      return;
    }

    console.log('Starting cache warming for pool:', state.swap.activeSwapPool[0]);
    this.isActive = true;

    // Immediately warm critical data
    this.warmCriticalData();

    // Set up background refresh intervals
    if (this.config.enableBackgroundRefresh) {
      this.startBackgroundRefresh();
    }
  }

  /**
   * Stop all cache warming activities
   */
  stop(): void {
    if (!this.isActive) return;

    console.log('Stopping cache warming');
    this.isActive = false;

    // Clear all intervals
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.intervals.clear();
  }

  /**
   * Restart cache warming (useful when switching pools)
   */
  async restart(): Promise<void> {
    this.stop();
    // Small delay to ensure cleanup
    setTimeout(() => this.start(), 100);
  }

  /**
   * Immediately warm critical data that's likely to be needed soon
   */
  private async warmCriticalData(): Promise<void> {
    const state = this.getState();
    if (!state.swap.activeSwapPool) return;

    const currentPoolId = state.swap.activeSwapPool[0];

    try {
      // Warm secondary ratio (most frequently accessed)
      if (shouldFetchData(state.swap.secondaryRatio, CACHE_DURATIONS.SECONDARY_RATIO, currentPoolId)) {
        console.log('Cache warming: fetching secondary ratio');
        this.dispatch(getSecondaryratio());
      }

      // Warm ICP price (used in multiple components)
      if (shouldFetchData({ data: state.icpLedger.icpPrice, lastFetch: state.icpLedger.icpPriceTimestamp }, CACHE_DURATIONS.ICP_PRICE)) {
        console.log('Cache warming: fetching ICP price');
        this.dispatch(getIcpPrice());
      }

      // Warm secondary fee (needed for transactions)
      if (shouldFetchData(state.swap.secondaryFee, CACHE_DURATIONS.FEES, currentPoolId)) {
        console.log('Cache warming: fetching secondary fee');
        this.dispatch(getSecondaryFee());
      }

      // Warm average APY (displayed prominently)
      if (shouldFetchData(state.swap.averageAPY, CACHE_DURATIONS.AVERAGE_APY, currentPoolId)) {
        console.log('Cache warming: fetching average APY');
        this.dispatch(getAverageApy());
      }

    } catch (error) {
      console.error('Error during cache warming:', error);
    }
  }

  /**
   * Warm only public data that doesn't require authentication
   * Note: ICP price now comes from XRC canister via icp_swap, so it requires activeSwapPool
   */
  private async warmPublicDataOnly(): Promise<void> {
    const state = this.getState();
    
    // ICP price now requires activeSwapPool to access the canister
    if (!state.swap.activeSwapPool) {
      console.log('Cache warming (public): No active swap pool - skipping ICP price fetch');
      return;
    }
    
    try {
      // ICP price from XRC canister (public data but requires canister call)
      if (shouldFetchData({ data: state.icpLedger.icpPrice, lastFetch: state.icpLedger.icpPriceTimestamp }, CACHE_DURATIONS.ICP_PRICE)) {
        console.log('Cache warming (public only): fetching ICP price from XRC canister');
        this.dispatch(getIcpPrice());
      }
    } catch (error) {
      console.error('Error during public data cache warming:', error);
    }
  }

  /**
   * Set up background refresh intervals for different data types
   */
  private startBackgroundRefresh(): void {
    // Secondary ratio - high frequency updates
    const ratioInterval = setInterval(async () => {
      const state = this.getState();
      if (state.swap.activeSwapPool && this.isActive) {
        // Check authentication before making canister calls
        const isAuthenticated = await isUserAuthenticated();
        if (!isAuthenticated) {
          console.log('Background refresh: skipping secondary ratio - not authenticated');
          return;
        }
        
        const currentPoolId = state.swap.activeSwapPool[0];
        if (shouldFetchData(state.swap.secondaryRatio, CACHE_DURATIONS.SECONDARY_RATIO, currentPoolId)) {
          console.log('Background refresh: secondary ratio');
          this.dispatch(getSecondaryratio());
        }
      }
    }, this.config.warmingIntervals.secondaryRatio);

    // ICP price - medium frequency
    const priceInterval = setInterval(() => {
      const state = this.getState();
      if (this.isActive) {
        if (shouldFetchData({ data: state.icpLedger.icpPrice, lastFetch: state.icpLedger.icpPriceTimestamp }, CACHE_DURATIONS.ICP_PRICE)) {
          console.log('Background refresh: ICP price');
          this.dispatch(getIcpPrice());
        }
      }
    }, this.config.warmingIntervals.icpPrice);

    // Average APY - lower frequency
    const apyInterval = setInterval(async () => {
      const state = this.getState();
      if (state.swap.activeSwapPool && this.isActive) {
        // Check authentication before making canister calls
        const isAuthenticated = await isUserAuthenticated();
        if (!isAuthenticated) {
          console.log('Background refresh: skipping average APY - not authenticated');
          return;
        }
        
        const currentPoolId = state.swap.activeSwapPool[0];
        if (shouldFetchData(state.swap.averageAPY, CACHE_DURATIONS.AVERAGE_APY, currentPoolId)) {
          console.log('Background refresh: average APY');
          this.dispatch(getAverageApy());
        }
      }
    }, this.config.warmingIntervals.averageAPY);

    // Store intervals for cleanup
    this.intervals.set('secondaryRatio', ratioInterval);
    this.intervals.set('icpPrice', priceInterval);
    this.intervals.set('averageAPY', apyInterval);
  }

  /**
   * Check if cache warming is currently active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get current configuration
   */
  getConfig(): CacheWarmingConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheWarmingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart with new config if currently running
    if (this.isActive) {
      this.restart();
    }
  }
}

// Export singleton instance that can be used across the app
let cacheWarmingManager: CacheWarmingManager | null = null;

export function initializeCacheWarming(dispatch: AppDispatch, getState: () => RootState): CacheWarmingManager {
  if (!cacheWarmingManager) {
    cacheWarmingManager = new CacheWarmingManager(dispatch, getState);
  }
  return cacheWarmingManager;
}

export function getCacheWarmingManager(): CacheWarmingManager | null {
  return cacheWarmingManager;
}

/**
 * Hook for components to trigger cache warming
 */
export function useCacheWarming() {
  return {
    startWarming: async () => await cacheWarmingManager?.start(),
    stopWarming: () => cacheWarmingManager?.stop(),
    restartWarming: async () => await cacheWarmingManager?.restart(),
    isWarming: () => cacheWarmingManager?.isRunning() ?? false,
  };
}