/**
 * Epoch validator - comprehensive validation logic
 */
class EpochValidator {
  constructor(projectionAnalyzer, insightsAnalyzer, canisterClient) {
    this.projectionAnalyzer = projectionAnalyzer;
    this.insightsAnalyzer = insightsAnalyzer;
    this.canisterClient = canisterClient;
  }

  /**
   * Validate cumulative supply accuracy
   * @returns {Promise<Object>} Validation result
   */
  async validateCumulativeAccuracy() {
    const actual = this.insightsAnalyzer.getCurrentState();
    const expected = this.projectionAnalyzer.getExpectedPrimaryAtBurn(actual.totalSecondaryBurned);

    const variance = ((actual.primarySupply - expected) / expected) * 100;
    const passed = Math.abs(variance) < 5; // 5% tolerance

    return {
      passed,
      variance,
      actual: actual.primarySupply,
      expected,
      totalSecondaryBurned: actual.totalSecondaryBurned
    };
  }

  /**
   * Validate thresholds array matches projection
   * @param {Object} tokenConfig - Token configuration
   * @returns {Promise<Object>} Validation result
   */
  async validateThresholdsArray(tokenConfig) {
    const canisterSchedule = await this.canisterClient.getTokenomicsSchedule();
    const actualThresholds = canisterSchedule.thresholds;
    const expectedThresholds = this.projectionAnalyzer.calculateProjectedThresholds(tokenConfig);

    const mismatches = [];
    const maxLength = Math.max(actualThresholds.length, expectedThresholds.length);

    for (let i = 0; i < maxLength; i++) {
      const actual = actualThresholds[i] || null;
      const expected = expectedThresholds[i] || null;

      if (actual !== expected) {
        mismatches.push({
          index: i,
          actual,
          expected
        });
      }
    }

    return {
      passed: mismatches.length === 0,
      mismatches,
      actualCount: actualThresholds.length,
      expectedCount: expectedThresholds.length,
      actualThresholds,
      expectedThresholds
    };
  }

  /**
   * Validate rewards array matches projection
   * @param {Object} tokenConfig - Token configuration
   * @returns {Promise<Object>} Validation result
   */
  async validateRewardsArray(tokenConfig) {
    const canisterSchedule = await this.canisterClient.getTokenomicsSchedule();
    const actualRewards = canisterSchedule.rewards; // Already in 4-decimal format
    const expectedRewards = this.projectionAnalyzer.calculateProjectedRewards(tokenConfig);

    const tolerance = 1; // Allow 1 unit difference in 4-decimal format
    const mismatches = [];
    const maxLength = Math.max(actualRewards.length, expectedRewards.length);

    for (let i = 0; i < maxLength; i++) {
      const actual = actualRewards[i] || null;
      const expected = expectedRewards[i] || null;

      if (actual === null || expected === null) {
        mismatches.push({
          index: i,
          actual,
          expected,
          difference: null
        });
      } else if (Math.abs(actual - expected) > tolerance) {
        mismatches.push({
          index: i,
          actual,
          expected,
          difference: actual - expected
        });
      }
    }

    return {
      passed: mismatches.length === 0,
      mismatches,
      actualCount: actualRewards.length,
      expectedCount: expectedRewards.length,
      actualRewards,
      expectedRewards,
      tolerance
    };
  }

  /**
   * Validate halving progression is consistent
   * @param {Object} tokenConfig - Token configuration
   * @returns {Promise<Object>} Validation result
   */
  async validateHalvingProgression(tokenConfig) {
    const canisterSchedule = await this.canisterClient.getTokenomicsSchedule();
    const rewards = canisterSchedule.rewards;

    const expectedRatio = tokenConfig.halving_step / 100; // e.g., 95% = 0.95
    const tolerance = 0.01; // 1% tolerance

    const violations = [];
    for (let i = 1; i < rewards.length; i++) {
      const actualRatio = rewards[i] / rewards[i - 1];
      const variance = Math.abs(actualRatio - expectedRatio);

      if (variance > tolerance) {
        violations.push({
          fromEpoch: i - 1,
          toEpoch: i,
          previousReward: rewards[i - 1],
          currentReward: rewards[i],
          actualRatio,
          expectedRatio,
          variance
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      expectedRatio,
      tolerance,
      totalEpochs: rewards.length
    };
  }

  /**
   * Validate current canister state consistency
   * @returns {Promise<Object>} Validation result
   */
  async validateCurrentState() {
    const currentIndex = await this.canisterClient.getCurrentThresholdIndex();
    const totalBurned = await this.canisterClient.getTotalSecondaryBurn();
    const insightsState = this.insightsAnalyzer.getCurrentState();

    // Check if burned amounts match
    const burnedMatch = totalBurned === insightsState.totalSecondaryBurned;

    // Get thresholds to verify index
    const schedule = await this.canisterClient.getTokenomicsSchedule();
    const thresholds = schedule.thresholds;

    // Verify: thresholds[currentIndex-1] < totalBurned <= thresholds[currentIndex]
    let indexCorrect = true;
    let indexReason = 'Index is correct for burn amount';

    if (currentIndex > 0 && currentIndex <= thresholds.length) {
      const prevThreshold = thresholds[currentIndex - 1];
      if (totalBurned <= prevThreshold) {
        indexCorrect = false;
        indexReason = `Total burned (${totalBurned}) should be > threshold[${currentIndex - 1}] (${prevThreshold})`;
      }
    }

    if (currentIndex < thresholds.length) {
      const currentThreshold = thresholds[currentIndex];
      if (totalBurned > currentThreshold) {
        indexCorrect = false;
        indexReason = `Total burned (${totalBurned}) should be ≤ threshold[${currentIndex}] (${currentThreshold})`;
      }
    }

    return {
      passed: burnedMatch && indexCorrect,
      currentIndex,
      totalBurned,
      insightsBurned: insightsState.totalSecondaryBurned,
      burnedMatch,
      indexCorrect,
      indexReason,
      thresholdCount: thresholds.length
    };
  }

  /**
   * Run full validation suite
   * @param {Object} tokenConfig - Token configuration
   * @returns {Promise<Object>} Complete validation results
   */
  async runFullValidation(tokenConfig) {
    console.log('  1/5 Validating cumulative accuracy...');
    const cumulativeAccuracy = await this.validateCumulativeAccuracy();

    console.log('  2/5 Validating thresholds array...');
    const thresholdsArray = await this.validateThresholdsArray(tokenConfig);

    console.log('  3/5 Validating rewards array...');
    const rewardsArray = await this.validateRewardsArray(tokenConfig);

    console.log('  4/5 Validating halving progression...');
    const halvingProgression = await this.validateHalvingProgression(tokenConfig);

    console.log('  5/5 Validating current state...');
    const currentState = await this.validateCurrentState();

    // Calculate overall pass/fail
    const results = {
      cumulativeAccuracy,
      thresholdsArray,
      rewardsArray,
      halvingProgression,
      currentState
    };

    const allPassed = Object.values(results).every(r => r.passed);

    return {
      passed: allPassed,
      ...results
    };
  }
}

module.exports = EpochValidator;
