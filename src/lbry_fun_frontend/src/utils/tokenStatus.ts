/**
 * Centralized utility for calculating token status and countdown
 * Ensures consistent status determination across all components
 */

export type TokenStatus = 'live' | 'pending' | 'failed';

/**
 * Calculate the status of a token based on its creation time and launch delay
 * @param createdAt - Token creation time in nanoseconds
 * @param launchDelaySeconds - Launch delay in seconds
 * @param poolCreationFailed - Whether pool creation failed
 * @param poolCreatedAt - Pool creation time in nanoseconds (0n if not created)
 * @param currentTimeNanos - Current time in nanoseconds (defaults to now)
 * @returns The token status
 */
export function calculateTokenStatus(
  createdAt: bigint,
  launchDelaySeconds: bigint,
  poolCreationFailed: boolean,
  poolCreatedAt: bigint,
  currentTimeNanos?: bigint
): TokenStatus {
  if (poolCreationFailed) {
    return 'failed';
  }

  const now = currentTimeNanos ?? BigInt(Date.now() * 1_000_000);
  const launchTime = createdAt + (launchDelaySeconds * BigInt(1_000_000_000));

  const isLive = poolCreatedAt > 0n && now >= launchTime;
  
  return isLive ? 'live' : 'pending';
}

/**
 * Calculate countdown timer for a pending token
 * @param createdAt - Token creation time in nanoseconds
 * @param launchDelaySeconds - Launch delay in seconds
 * @param currentTimeNanos - Current time in nanoseconds (defaults to now)
 * @returns Object with seconds remaining and isLive status
 */
export function calculateCountdown(
  createdAt: bigint,
  launchDelaySeconds: bigint,
  currentTimeNanos?: bigint
): { seconds: number; isLive: boolean } {
  const now = currentTimeNanos ?? BigInt(Date.now() * 1_000_000);
  const launchTime = createdAt + (launchDelaySeconds * BigInt(1_000_000_000));
  
  if (now >= launchTime) {
    return { seconds: 0, isLive: true };
  }
  
  const remainingNanos = launchTime - now;
  const remainingSeconds = Number(remainingNanos / BigInt(1_000_000_000));
  
  return { seconds: remainingSeconds, isLive: false };
}

/**
 * Format countdown time into human-readable string
 * @param seconds - Number of seconds remaining
 * @returns Formatted string like "2h 30m" or "45s"
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0s";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && hours === 0) parts.push(`${secs}s`);
  
  return parts.join(' ') || "0s";
}

/**
 * Convert string values from TokenRecordStringified to bigints for calculations
 * @param createdTime - Creation time as string
 * @param launchDelaySeconds - Launch delay as string
 * @param poolCreatedAt - Pool creation time as string
 * @returns Object with bigint values
 */
export function parseTokenTimings(
  createdTime: string,
  launchDelaySeconds: string,
  poolCreatedAt: string | undefined
): {
  createdAt: bigint;
  launchDelay: bigint;
  poolCreatedAt: bigint;
} {
  return {
    createdAt: BigInt(createdTime),
    launchDelay: BigInt(launchDelaySeconds),
    poolCreatedAt: poolCreatedAt ? BigInt(poolCreatedAt) : BigInt(0)
  };
}