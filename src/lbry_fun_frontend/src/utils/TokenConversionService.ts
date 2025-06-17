export class TokenConversionService {
  private static readonly E8S = 100_000_000;

  /**
   * Converts e8s (backend format) to natural units (display format)
   * @param e8sAmount - Amount in e8s format (bigint or string)
   * @returns Amount in natural units as a number
   */
  static e8sToNatural(e8sAmount: bigint | string | number): number {
    const amount = typeof e8sAmount === 'bigint' 
      ? e8sAmount 
      : BigInt(e8sAmount.toString());
    return Number(amount) / this.E8S;
  }

  /**
   * Converts natural units (user input) to e8s (backend format)
   * @param naturalAmount - Amount in natural units
   * @returns Amount in e8s format as bigint
   */
  static naturalToE8s(naturalAmount: number | string): bigint {
    const amount = Number(naturalAmount);
    return BigInt(Math.round(amount * this.E8S));
  }

  /**
   * Formats a natural unit amount for display
   * @param amount - Amount in natural units
   * @param decimals - Number of decimal places to show (default 4)
   * @returns Formatted string
   */
  static formatDisplay(amount: number, decimals: number = 4): string {
    return amount.toFixed(decimals);
  }

  /**
   * Formats an e8s amount directly for display
   * @param e8sAmount - Amount in e8s format
   * @param decimals - Number of decimal places to show (default 4)
   * @returns Formatted string
   */
  static formatE8sDisplay(e8sAmount: bigint | string | number, decimals: number = 4): string {
    const natural = this.e8sToNatural(e8sAmount);
    return this.formatDisplay(natural, decimals);
  }

  /**
   * Alias for e8sToNatural for compatibility with LedgerService
   * @param e8s - Amount in e8s format
   * @returns Amount in ICP (natural units)
   */
  static e8sToIcp(e8s: bigint): number {
    return this.e8sToNatural(e8s);
  }

  /**
   * Formats ICP amount with 2 decimal places and " ICP" suffix
   * @param icp - Amount in ICP (natural units)
   * @returns Formatted string with " ICP" suffix
   */
  static displayIcp(icp: number): string {
    return icp.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + " ICP";
  }

  /**
   * Converts e8s to ICP and formats with 2 decimal places and " ICP" suffix
   * @param e8s - Amount in e8s format
   * @returns Formatted string with " ICP" suffix
   */
  static displayE8sAsIcp(e8s: bigint): string {
    return this.displayIcp(this.e8sToIcp(e8s));
  }

  /**
   * Get the E8S constant
   * @returns The E8S constant (100,000,000)
   */
  static getE8S(): number {
    return this.E8S;
  }
}

// Export the E8S constant for use elsewhere
export const E8S = 100_000_000;