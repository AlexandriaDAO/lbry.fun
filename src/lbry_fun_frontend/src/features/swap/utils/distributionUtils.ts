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
  const now = Date.now();
  const intervalMs = Number(intervalSeconds) * 1000;
  const nextTime = Math.ceil(now / intervalMs) * intervalMs;
  return new Date(nextTime);
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