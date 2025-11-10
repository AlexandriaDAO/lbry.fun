/**
 * Analyzer for insights data from Insights tab (actual blockchain data)
 */
class InsightsAnalyzer {
  constructor(insightsData) {
    this.data = insightsData;
    this.summary = insightsData.summary || {};
    this.graphs = insightsData.graphs || {};
  }

  /**
   * Get current state from summary data
   * @returns {Object} Current state with all metrics
   */
  getCurrentState() {
    return {
      primarySupply: this.summary.primaryTokenSupply || 0,
      secondarySupply: this.summary.secondaryTokenSupply || 0,
      totalSecondaryBurned: this.summary.totalSecondaryBurned || 0,
      stakedAmount: this.summary.stakedAmount || 0,
      stakerCount: this.summary.stakerCount || 0,
      apy: this.summary.apy || 0,
      hourlyIcpRewards: this.summary.hourlyIcpRewards || 0
    };
  }

  /**
   * Get time series data from graphs
   * @returns {Object} Time series data for all metrics
   */
  getTimeSeriesData() {
    return {
      time: this.graphs.time || [],
      primaryTokenSupply: this.graphs.primaryTokenSupply || {},
      totalSecondaryBurned: this.graphs.totalSecondaryBurned || {},
      secondaryTokenSupply: this.graphs.secondaryTokenSupply || {},
      stakedAmount: this.graphs.stakedAmount || {},
      stakerCount: this.graphs.stakerCount || {},
      apy: this.graphs.apy || {},
      hourlyIcpRewards: this.graphs.hourlyIcpRewards || {}
    };
  }

  /**
   * Detect anomalies in the data
   * @returns {Array<{type: string, message: string}>} Array of warnings
   */
  detectAnomalies() {
    const warnings = [];
    const state = this.getCurrentState();

    // Check for zero APY when it shouldn't be
    if (state.stakedAmount > 0 && state.apy === 0) {
      warnings.push({
        type: 'apy_zero',
        message: 'APY showing 0 despite staked amount > 0'
      });
    }

    // Check for zero hourly rewards
    if (state.stakedAmount > 0 && state.hourlyIcpRewards === 0) {
      warnings.push({
        type: 'rewards_zero',
        message: 'Hourly ICP rewards showing 0 despite staked amount > 0'
      });
    }

    // Check for impossible negative changes in time series
    const timeSeries = this.getTimeSeriesData();
    if (timeSeries.primaryTokenSupply.yAxis) {
      const supply = timeSeries.primaryTokenSupply.yAxis;
      for (let i = 1; i < supply.length; i++) {
        if (supply[i] < supply[i - 1]) {
          warnings.push({
            type: 'supply_decreased',
            message: `Primary supply decreased at index ${i}: ${supply[i - 1]} → ${supply[i]}`
          });
          break; // Only report first occurrence
        }
      }
    }

    if (timeSeries.totalSecondaryBurned.yAxis) {
      const burned = timeSeries.totalSecondaryBurned.yAxis;
      for (let i = 1; i < burned.length; i++) {
        if (burned[i] < burned[i - 1]) {
          warnings.push({
            type: 'burned_decreased',
            message: `Total secondary burned decreased at index ${i}: ${burned[i - 1]} → ${burned[i]}`
          });
          break; // Only report first occurrence
        }
      }
    }

    return warnings;
  }

  /**
   * Get pool metadata
   * @returns {Object} Pool metadata
   */
  getMetadata() {
    return {
      poolId: this.data.poolId,
      timestamp: this.data.timestamp
    };
  }
}

module.exports = InsightsAnalyzer;
