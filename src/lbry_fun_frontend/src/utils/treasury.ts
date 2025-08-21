export const formatE8sToICP = (e8s: bigint): string => {
  return (Number(e8s) / 1e8).toFixed(8);
};

export const formatDiscrepancy = (e8s: bigint): string => {
  const icp = Number(e8s) / 1e8;
  const prefix = e8s > 0n ? '+' : '';
  return `${prefix}${icp.toFixed(8)} ICP`;
};

export const formatBasisPoints = (bp: number | bigint): string => {
  const value = typeof bp === 'bigint' ? Number(bp) : bp;
  return (value / 10000).toFixed(2) + '%';
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

export const calculateTimeUntilNextDistribution = (
  lastDistribution: bigint,
  intervalSeconds: number = 3600
): string => {
  // Guard against invalid intervals
  if (!intervalSeconds || intervalSeconds <= 0) {
    console.error(`Invalid interval: ${intervalSeconds}s, using default`);
    intervalSeconds = 3600;
  }
  
  const now = Date.now() * 1_000_000; // Convert to nanoseconds
  const timeSinceLastDistribution = now - Number(lastDistribution);
  const intervalNanos = intervalSeconds * 1_000_000_000;
  const timeUntilNext = intervalNanos - (timeSinceLastDistribution % intervalNanos);
  
  const minutes = Math.floor(timeUntilNext / (60 * 1_000_000_000));
  const hours = Math.floor(minutes / 60);
  
  if (minutes < 1) {
    return 'Less than 1 minute';
  } else if (minutes < 60) {
    return `In ~${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else if (hours < 24) {
    const remainingMins = minutes % 60;
    return remainingMins > 0 
      ? `In ~${hours}h ${remainingMins}m`
      : `In ~${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    const days = Math.floor(hours / 24);
    return `In ~${days} day${days > 1 ? 's' : ''}`;
  }
};