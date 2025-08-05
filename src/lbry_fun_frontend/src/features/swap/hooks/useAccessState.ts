import { useMemo, useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { AccessState } from '../types/accessControl.types';
import { RootState } from '@/store';

export function useAccessState() {
  const { isAuthenticated, isLoading: authLoading } = useAppSelector((state: RootState) => state.auth);
  const swap = useAppSelector((state: RootState) => state.swap);
  const operations = useAppSelector((state: RootState) => state.swap.operations);
  const [countdown, setCountdown] = useState<number>(0);
  const [launchTime, setLaunchTime] = useState<Date | undefined>();

  // Simply use the isLive field from the token record
  const isTokenLive = swap.activeSwapPool?.[1]?.isLive || false;

  // Calculate countdown if token is not live
  useEffect(() => {
    if (!isTokenLive && swap.activeSwapPool?.[1]) {
      const tokenRecord = swap.activeSwapPool[1];
      
      try {
        // Defensive programming: validate fields exist and are valid
        const launchedAtStr = tokenRecord.launched_at;
        const launchDelayStr = tokenRecord.launch_delay_seconds || '86400'; // 24 hours default
        
        // Handle case where launched_at might be '0' or undefined
        let launchedAt = BigInt(0);
        if (launchedAtStr && launchedAtStr !== '0') {
          launchedAt = BigInt(launchedAtStr);
        } else {
          // Fallback to created_time if launched_at is not set
          const createdTimeStr = tokenRecord.created_time;
          if (createdTimeStr && createdTimeStr !== '0') {
            launchedAt = BigInt(createdTimeStr);
          } else {
            // If neither field is valid, clear countdown
            setCountdown(0);
            setLaunchTime(undefined);
            return;
          }
        }
        
        const launchDelaySeconds = BigInt(launchDelayStr);
        
        // Launch time is launched_at + launch_delay_seconds (converted to nanoseconds)
        const launchTimeNanos = launchedAt + (launchDelaySeconds * BigInt(1_000_000_000));
        const launchTimeMillis = Number(launchTimeNanos / BigInt(1_000_000));
        
        // Validate the calculated time is reasonable (not in the distant past or future)
        const now = Date.now();
        const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);
        
        if (launchTimeMillis < 0 || launchTimeMillis > oneYearFromNow) {
          console.warn('Invalid launch time calculated:', launchTimeMillis);
          setCountdown(0);
          setLaunchTime(undefined);
          return;
        }
        
        const launchDate = new Date(launchTimeMillis);
        setLaunchTime(launchDate);
        
        // Update countdown function
        const updateCountdown = () => {
          const currentTime = Date.now();
          const secondsUntilLaunch = Math.max(0, Math.floor((launchTimeMillis - currentTime) / 1000));
          setCountdown(secondsUntilLaunch);
        };
        
        // Initial update
        updateCountdown();
        
        // Update every second
        const interval = setInterval(updateCountdown, 1000);
        
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Error calculating countdown:', error);
        setCountdown(0);
        setLaunchTime(undefined);
      }
    } else {
      setCountdown(0);
      setLaunchTime(undefined);
    }
  }, [isTokenLive, swap.activeSwapPool]);

  // Determine access state
  const accessState = useMemo(() => {
    const anyOperationPending = Object.values(operations).some(status => status === 'pending');
    if (authLoading || anyOperationPending) {
      return AccessState.LOADING;
    }
    
    if (!isAuthenticated) {
      return AccessState.UNAUTHENTICATED;
    }
    
    if (!isTokenLive) {
      return AccessState.AWAITING_LAUNCH;
    }
    
    return AccessState.FULL_ACCESS;
  }, [authLoading, operations, isAuthenticated, isTokenLive]);

  return {
    accessState,
    countdown,
    launchTime,
    isTokenLive
  };
}