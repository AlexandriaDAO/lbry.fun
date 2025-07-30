export const formatE8sToICP = (e8s: bigint): string => {
  return (Number(e8s) / 1e8).toFixed(8);
};

export const formatDiscrepancy = (e8s: bigint): string => {
  const icp = Number(e8s) / 1e8;
  const prefix = e8s > 0n ? '+' : '';
  return `${prefix}${icp.toFixed(8)} ICP`;
};

export const formatBasisPoints = (bp: number): string => {
  return (bp / 10000).toFixed(2) + '%';
};

export const formatNanoTimestamp = (ns: bigint): string => {
  const date = new Date(Number(ns) / 1_000_000);
  return date.toLocaleString();
};

export const getHealthColor = (status: 'healthy' | 'warning' | 'error'): string => {
  const colors = {
    healthy: 'text-lime-400',
    warning: 'text-amber-400',
    error: 'text-red-400'
  };
  return colors[status];
};

export const calculateTimeUntilNextDistribution = (lastDistribution: bigint): string => {
  const now = Date.now() * 1_000_000; // Convert to nanoseconds
  const timeSinceLastDistribution = now - Number(lastDistribution);
  const hourInNanos = 60 * 60 * 1_000_000_000;
  const timeUntilNext = hourInNanos - (timeSinceLastDistribution % hourInNanos);
  
  const minutes = Math.floor(timeUntilNext / (60 * 1_000_000_000));
  if (minutes < 60) {
    return `In ~${minutes} minutes`;
  }
  return 'In ~1 hour';
};