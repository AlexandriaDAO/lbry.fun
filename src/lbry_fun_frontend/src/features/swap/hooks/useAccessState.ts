import { useMemo, useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { AccessState } from '../types/accessControl.types';
import { RootState } from '@/store';

export function useAccessState() {
  const { isAuthenticated, isLoading: authLoading } = useAppSelector((state: RootState) => state.auth);
  const swap = useAppSelector((state: RootState) => state.swap);
  const [countdown, setCountdown] = useState<number>(0);
  const [launchTime, setLaunchTime] = useState<Date | undefined>();

  // Calculate if token is live based on the same logic as backend
  const isTokenLive = useMemo(() => {
    if (!swap.activeSwapPool?.[1]) return false;
    
    const tokenRecord = swap.activeSwapPool[1];
    const currentTimeNanos = Date.now() * 1000000; // Convert to nanoseconds
    
    // Use launch_delay_seconds from token record, default to 24 hours if not present
    const launchDelaySeconds = tokenRecord.launch_delay_seconds || 86400; // 24 hours default
    const launchDelayNanos = BigInt(launchDelaySeconds) * BigInt(1_000_000_000);
    
    // Token is live if pool created successfully and launch delay has passed
    return !tokenRecord.pool_creation_failed && 
           Number(tokenRecord.pool_created_at) > 0 && 
           currentTimeNanos >= Number(tokenRecord.created_time) + Number(launchDelayNanos);
  }, [swap.activeSwapPool]);

  // Calculate countdown if token is not live
  useEffect(() => {
    if (!isTokenLive && swap.activeSwapPool?.[1]) {
      const tokenRecord = swap.activeSwapPool[1];
      const currentTimeNanos = Date.now() * 1000000;
      
      // Use launch_delay_seconds from token record, default to 24 hours if not present
      const launchDelaySeconds = tokenRecord.launch_delay_seconds || 86400; // 24 hours default
      const launchDelayNanos = BigInt(launchDelaySeconds) * BigInt(1_000_000_000);
      const launchTimeNanos = Number(tokenRecord.created_time) + Number(launchDelayNanos);
      
      if (launchTimeNanos > currentTimeNanos) {
        const remainingNanos = launchTimeNanos - currentTimeNanos;
        const remainingSeconds = Math.floor(remainingNanos / 1_000_000_000);
        setCountdown(remainingSeconds);
        
        // Set launch time
        const launchDate = new Date(launchTimeNanos / 1_000_000); // Convert nanos to millis
        setLaunchTime(launchDate);
      }
    }
  }, [isTokenLive, swap.activeSwapPool]);

  // Determine access state
  const accessState = useMemo(() => {
    if (authLoading || swap.loading) {
      return AccessState.LOADING;
    }
    
    if (!isAuthenticated) {
      return AccessState.UNAUTHENTICATED;
    }
    
    if (!isTokenLive) {
      return AccessState.AWAITING_LAUNCH;
    }
    
    return AccessState.FULL_ACCESS;
  }, [authLoading, swap.loading, isAuthenticated, isTokenLive]);

  return {
    accessState,
    countdown,
    launchTime,
    isTokenLive
  };
}