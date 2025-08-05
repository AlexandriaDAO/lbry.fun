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