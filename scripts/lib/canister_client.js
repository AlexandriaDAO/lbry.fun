const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Client for querying tokenomics canister via dfx CLI
 */
class TokenomicsCanisterClient {
  constructor(canisterId, network = 'ic') {
    this.canisterId = canisterId;
    this.network = network;
  }

  /**
   * Get current threshold index
   * @returns {Promise<number>}
   */
  async getCurrentThresholdIndex() {
    const output = await this._executeQuery('get_current_threshold_index');
    return this._parseCandidOutput(output, 'u32');
  }

  /**
   * Get total secondary tokens burned
   * @returns {Promise<number>}
   */
  async getTotalSecondaryBurn() {
    const output = await this._executeQuery('get_total_secondary_burn');
    return this._parseCandidOutput(output, 'u64');
  }

  /**
   * Get current primary rate
   * @returns {Promise<{ok: number} | {err: string}>}
   */
  async getCurrentPrimaryRate() {
    const output = await this._executeQuery('get_current_primary_rate');
    return this._parseCandidOutput(output, 'Result<u64, String>');
  }

  /**
   * Get current secondary threshold
   * @returns {Promise<{ok: number} | {err: string}>}
   */
  async getCurrentSecondaryThreshold() {
    const output = await this._executeQuery('get_current_secondary_threshold');
    return this._parseCandidOutput(output, 'Result<u64, String>');
  }

  /**
   * Get tokenomics schedule (thresholds and rewards)
   * @returns {Promise<{thresholds: number[], rewards: number[]}>}
   */
  async getTokenomicsSchedule() {
    const output = await this._executeQuery('get_tokenomics_schedule');
    const result = this._parseCandidOutput(output, 'TokenomicsSchedule');

    // CRITICAL: Rewards are in 4-decimal format, multiply by 10,000 for E8S
    // No conversion needed - keep in 4-decimal format for comparison
    return result;
  }

  /**
   * Execute dfx canister query command
   * @private
   */
  async _executeQuery(method) {
    const command = `dfx canister call --network ${this.network} ${this.canisterId} ${method}`;

    try {
      const { stdout, stderr } = await execPromise(command);
      if (stderr && !stderr.includes('warning')) {
        console.warn('Warning from dfx:', stderr);
      }
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to query canister: ${error.message}`);
    }
  }

  /**
   * Parse candid output based on expected type
   * @private
   */
  _parseCandidOutput(output, expectedType) {
    try {
      if (expectedType === 'u32' || expectedType === 'u64') {
        // Parse: (5 : nat32) or (5_663_571 : nat64)
        const match = output.match(/\(([0-9_]+)\s*:/);
        if (!match) {
          throw new Error(`Cannot parse ${expectedType} from: ${output}`);
        }
        return parseInt(match[1].replace(/_/g, ''), 10);
      }

      if (expectedType.startsWith('Result<')) {
        // Parse: (variant { Ok = 123_456 : nat64 }) or (variant { Err = "Error message" })
        if (output.includes('Ok =')) {
          const match = output.match(/Ok\s*=\s*([0-9_]+)/);
          if (!match) {
            throw new Error(`Cannot parse Ok value from: ${output}`);
          }
          return { ok: parseInt(match[1].replace(/_/g, ''), 10) };
        } else if (output.includes('Err =')) {
          const match = output.match(/Err\s*=\s*"([^"]*)"/);
          if (!match) {
            throw new Error(`Cannot parse Err value from: ${output}`);
          }
          return { err: match[1] };
        }
        throw new Error(`Cannot parse Result from: ${output}`);
      }

      if (expectedType === 'TokenomicsSchedule') {
        // Parse: (record { thresholds = vec { ... }; rewards = vec { ... } })
        const thresholdsMatch = output.match(/thresholds\s*=\s*vec\s*{([^}]*)}/);
        const rewardsMatch = output.match(/rewards\s*=\s*vec\s*{([^}]*)}/);

        if (!thresholdsMatch || !rewardsMatch) {
          throw new Error(`Cannot parse TokenomicsSchedule from: ${output}`);
        }

        const thresholds = this._parseVec(thresholdsMatch[1]);
        const rewards = this._parseVec(rewardsMatch[1]);

        return { thresholds, rewards };
      }

      throw new Error(`Unknown type: ${expectedType}`);
    } catch (error) {
      throw new Error(`Failed to parse candid output: ${error.message}\nRaw output: ${output}`);
    }
  }

  /**
   * Parse candid vec (array)
   * @private
   */
  _parseVec(vecContent) {
    // Parse: 1_000_000 : nat64; 1_500_000 : nat64; ...
    const numbers = vecContent.match(/([0-9_]+)\s*:/g);
    if (!numbers) {
      return [];
    }
    return numbers.map(n => parseInt(n.replace(/[_:]/g, '').trim(), 10));
  }
}

module.exports = TokenomicsCanisterClient;
