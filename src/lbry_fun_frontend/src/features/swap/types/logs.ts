export interface ProcessedLogsData {
  time: number[];
  primaryTokenSupply: number[];
  secondaryTokenSupply: number[];
  totalSecondaryBurned: number[];
  totalPrimaryStaked: number[];
  stakerCount: number[];
  apy: number[] | null; // Will be null until we have market pricing
  hourlyIcpRewards: number[]; // ICP rewards per primary token per hour
} 