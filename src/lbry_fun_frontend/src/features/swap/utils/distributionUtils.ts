import { TokenConversionService } from "@/utils/TokenConversionService";
import type { LpProvisionStatus } from "../types/distributionTypes";

export const formatDistributionAmount = (amount: bigint): string => {
  return TokenConversionService.displayE8sAsIcp(Number(amount));
};

export const calculatePercentage = (part: bigint, total: bigint): number => {
  if (total === 0n) return 0;
  return Number((part * 10000n) / total) / 100;
};

export const formatLpProvisionStatus = (status: LpProvisionStatus): {
  text: string;
  className: string;
} => {
  if ('Pending' in status) {
    return { text: 'PENDING', className: 'terminal-status-loading' };
  }
  if ('Success' in status) {
    return { text: 'SUCCESS', className: 'terminal-status-success' };
  }
  if ('Failed' in status) {
    return { text: 'FAILED', className: 'terminal-status-error' };
  }
  return { text: 'UNKNOWN', className: 'terminal-accent' };
};

export const getNextDistributionTime = (intervalSeconds: bigint): Date => {
  // Guard against invalid intervals
  const interval = Number(intervalSeconds);
  if (!interval || interval <= 0) {
    console.error(`Invalid interval for next distribution: ${interval}s, using default`);
    const defaultInterval = 3600; // 1 hour default
    const intervalMs = defaultInterval * 1000;
    const now = Date.now();
    const nextTime = Math.ceil(now / intervalMs) * intervalMs;
    return new Date(nextTime);
  }
  
  const now = Date.now();
  const intervalMs = interval * 1000;
  const nextTime = Math.ceil(now / intervalMs) * intervalMs;
  return new Date(nextTime);
};

export const formatDistributionInterval = (seconds: number): string => {
  // Guard against invalid values
  if (!seconds || seconds <= 0) {
    return 'INVALID INTERVAL';
  }
  
  if (seconds < 60) {
    return `${seconds} SECOND${seconds !== 1 ? 'S' : ''}`;
  } else if (seconds < 3600) {
    const minutes = seconds / 60;
    // Handle partial minutes (e.g., 90 seconds = 1.5 minutes)
    if (minutes % 1 !== 0 && seconds < 120) {
      return `${seconds} SECONDS`;
    }
    return `${Math.floor(minutes)} MINUTE${Math.floor(minutes) !== 1 ? 'S' : ''}`;
  } else if (seconds < 86400) {
    const hours = seconds / 3600;
    // Handle partial hours (e.g., 5400 seconds = 1.5 hours)
    if (hours % 1 !== 0) {
      const decimalHours = hours.toFixed(1);
      return `${decimalHours} HOURS`;
    }
    return `${Math.floor(hours)} HOUR${Math.floor(hours) !== 1 ? 'S' : ''}`;
  } else {
    const days = seconds / 86400;
    // Handle partial days
    if (days % 1 !== 0) {
      const decimalDays = days.toFixed(1);
      return `${decimalDays} DAYS`;
    }
    return `${Math.floor(days)} DAY${Math.floor(days) !== 1 ? 'S' : ''}`;
  }
};

export const formatTimestamp = (timestamp: bigint): string => {
  const date = new Date(Number(timestamp) / 1_000_000); // Convert nanoseconds to milliseconds
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatCountdown = (targetTime: Date): string => {
  const now = Date.now();
  const target = targetTime.getTime();
  const diff = target - now;
  
  if (diff <= 0) return 'NOW';
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  
  return `${minutes}m ${seconds}s`;
};

export const getPoolBadgeClass = (pool: 'alexandria' | 'lp' | 'stakers'): string => {
  switch (pool) {
    case 'alexandria':
      return 'terminal-pool-badge-alexandria';
    case 'lp':
      return 'terminal-pool-badge-lp';
    case 'stakers':
      return 'terminal-pool-badge-stakers';
    default:
      return '';
  }
};