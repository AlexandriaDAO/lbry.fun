/**
 * Analyzer for projection data from Tokenomics tab
 */
class ProjectionAnalyzer {
  constructor(projectionData) {
    this.data = projectionData;
    this.graphs = projectionData.graphs || {};
  }

  /**
   * Get expected primary tokens minted at a given secondary burn amount
   * @param {number} secondaryBurned - Amount of secondary tokens burned (E8S)
   * @returns {number} Expected primary tokens minted (E8S)
   */
  getExpectedPrimaryAtBurn(secondaryBurned) {
    const cumulative = this.graphs.cumulativeSupply;
    if (!cumulative || !cumulative.xAxis || !cumulative.yAxis) {
      throw new Error('Missing cumulativeSupply data in projection');
    }

    const xAxis = cumulative.xAxis; // Secondary burned
    const yAxis = cumulative.yAxis; // Primary minted

    // Find position where secondaryBurned falls
    for (let i = 0; i < xAxis.length; i++) {
      if (xAxis[i] >= secondaryBurned) {
        if (i === 0) {
          return yAxis[0];
        }
        // Linear interpolation
        const x0 = xAxis[i - 1];
        const x1 = xAxis[i];
        const y0 = yAxis[i - 1];
        const y1 = yAxis[i];
        const ratio = (secondaryBurned - x0) / (x1 - x0);
        return y0 + ratio * (y1 - y0);
      }
    }

    // Beyond last data point, return last value
    return yAxis[yAxis.length - 1];
  }

  /**
   * Get projected epochs with mint amounts
   * @returns {Array<{epochNumber: number, primaryMinted: number}>}
   */
  getProjectedEpochs() {
    const mintedPerEpoch = this.graphs.mintedPerEpoch;
    if (!mintedPerEpoch || !mintedPerEpoch.xAxis || !mintedPerEpoch.yAxis) {
      throw new Error('Missing mintedPerEpoch data in projection');
    }

    const epochs = [];
    for (let i = 0; i < mintedPerEpoch.xAxis.length; i++) {
      const epochLabel = mintedPerEpoch.xAxis[i]; // "Epoch 1", "Epoch 2", etc.
      const epochNumber = parseInt(epochLabel.replace(/[^0-9]/g, ''), 10);
      const primaryMinted = mintedPerEpoch.yAxis[i];

      epochs.push({
        epochNumber,
        primaryMinted
      });
    }

    return epochs;
  }

  /**
   * Calculate projected thresholds based on config
   * @param {Object} config - Token configuration
   * @returns {number[]} Thresholds array in E8S
   */
  calculateProjectedThresholds(config) {
    const epochs = this.getProjectedEpochs();
    const thresholds = [];

    let currentThreshold = config.initial_secondary_burn;
    for (let i = 0; i < epochs.length; i++) {
      thresholds.push(currentThreshold);
      currentThreshold = Math.floor(currentThreshold * config.threshold_multiplier);
    }

    return thresholds;
  }

  /**
   * Calculate projected rewards based on config
   * @param {Object} config - Token configuration
   * @returns {number[]} Rewards array in 4-decimal format (NOT E8S)
   */
  calculateProjectedRewards(config) {
    const epochs = this.getProjectedEpochs();
    const rewards = [];

    // Convert initial reward from E8S to 4-decimal format
    let currentReward = Math.floor(config.initial_reward_per_burn_unit / 10000);

    for (let i = 0; i < epochs.length; i++) {
      rewards.push(currentReward);
      // Apply halving step
      currentReward = Math.floor(currentReward * (config.halving_step / 100));
    }

    return rewards;
  }

  /**
   * Get cost curve data
   * @returns {Object} Cost curve graph data
   */
  getCostCurve() {
    return this.graphs.costToMint || null;
  }

  /**
   * Get cumulative USD cost data
   * @returns {Object} Cumulative cost graph data
   */
  getCumulativeCost() {
    return this.graphs.cumulativeUsdCost || null;
  }
}

module.exports = ProjectionAnalyzer;
