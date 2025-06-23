// Launch Period Constants
// Time before trading is enabled after token creation

// Testing: 1 microsecond (1000 nanoseconds)
export const LAUNCH_PERIOD_NANOS = BigInt(1000);

// Production: 24 hours in nanoseconds
// export const LAUNCH_PERIOD_NANOS = BigInt(24 * 60 * 60 * 1_000_000_000);

// Helper to get launch period in different units
export const LAUNCH_PERIOD = {
  nanos: LAUNCH_PERIOD_NANOS,
  millis: Number(LAUNCH_PERIOD_NANOS / BigInt(1_000_000)),
  seconds: Number(LAUNCH_PERIOD_NANOS / BigInt(1_000_000_000)),
  minutes: Number(LAUNCH_PERIOD_NANOS / BigInt(60 * 1_000_000_000)),
  hours: Number(LAUNCH_PERIOD_NANOS / BigInt(60 * 60 * 1_000_000_000))
};