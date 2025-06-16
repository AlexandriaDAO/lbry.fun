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
}

// Export the E8S constant for use elsewhere
export const E8S = 100_000_000;