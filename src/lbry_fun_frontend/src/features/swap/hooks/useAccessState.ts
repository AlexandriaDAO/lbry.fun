import { useMemo, useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { AccessState } from '../types/accessControl.types';
import { RootState } from '@/store';
import { calculateTokenStatus, calculateCountdown, parseTokenTimings } from '@/utils/tokenStatus';

export function useAccessState() {
  const { isAuthenticated, isLoading: authLoading } = useAppSelector((state: RootState) => state.auth);
  const swap = useAppSelector((state: RootState) => state.swap);
  const [countdown, setCountdown] = useState<number>(0);
  const [launchTime, setLaunchTime] = useState<Date | undefined>();

  // Calculate if token is live based on the same logic as backend
  const isTokenLive = useMemo(() => {
    if (!swap.activeSwapPool?.[1]) return false;
    
    const tokenRecord = swap.activeSwapPool[1];
    
    // Use launch_delay_seconds from token record, default to 24 hours if not present
    const launchDelaySeconds = tokenRecord.launch_delay_seconds || '86400'; // 24 hours default
    
    const { createdAt, launchDelay, poolCreatedAt } = parseTokenTimings(
      tokenRecord.created_time,
      launchDelaySeconds,
      tokenRecord.pool_created_at
    );
    
    const status = calculateTokenStatus(
      createdAt,
      launchDelay,
      tokenRecord.pool_creation_failed,
      poolCreatedAt
    );
    
    return status === 'live';
  }, [swap.activeSwapPool]);

  // Calculate countdown if token is not live
  useEffect(() => {
    if (!isTokenLive && swap.activeSwapPool?.[1]) {
      const tokenRecord = swap.activeSwapPool[1];
      
      // Use launch_delay_seconds from token record, default to 24 hours if not present
      const launchDelaySeconds = tokenRecord.launch_delay_seconds || '86400'; // 24 hours default
      
      const { createdAt, launchDelay } = parseTokenTimings(
        tokenRecord.created_time,
        launchDelaySeconds,
        tokenRecord.pool_created_at
      );
      
      const { seconds, isLive } = calculateCountdown(createdAt, launchDelay);
      
      if (!isLive && seconds > 0) {
        setCountdown(seconds);
        
        // Set launch time
        const launchTimeNanos = createdAt + (launchDelay * BigInt(1_000_000_000));
        const launchDate = new Date(Number(launchTimeNanos / BigInt(1_000_000))); // Convert nanos to millis
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