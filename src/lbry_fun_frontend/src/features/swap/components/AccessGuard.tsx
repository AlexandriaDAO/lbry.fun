import React, { useEffect, useState } from 'react';
import { Lock, Clock, AlertCircle } from 'lucide-react';
import { AccessState, AccessGuardProps } from '../types/accessControl.types';
import { Entry } from '@/layouts/parts/Header';

const AccessGuard: React.FC<AccessGuardProps> = ({ 
  children, 
  accessState, 
  countdown, 
  launchTime,
  onAuthenticate 
}) => {
  const [timeRemaining, setTimeRemaining] = useState(countdown || 0);

  useEffect(() => {
    if (accessState === AccessState.AWAITING_LAUNCH && countdown) {
      setTimeRemaining(countdown);
      
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [accessState, countdown]);

  // Full access - render children normally
  if (accessState === AccessState.FULL_ACCESS) {
    return <>{children}</>;
  }

  // Loading state
  if (accessState === AccessState.LOADING) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">{children}</div>
      </div>
    );
  }

  // Format countdown display
  const formatCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // For non-authenticated users, show a banner instead of blocking the UI
  if (accessState === AccessState.UNAUTHENTICATED) {
    return (
      <div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-2">
              Connect your wallet to enable trading
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              You're viewing live rates and stats. Connect to swap, burn, or stake tokens.
            </p>
            <Entry />
          </div>
        </div>
        {children}
      </div>
    );
  }

  // For awaiting launch, show a countdown banner
  if (accessState === AccessState.AWAITING_LAUNCH) {
    return (
      <div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-2">
              Trading starts in {formatCountdown(timeRemaining)}
            </p>
            {launchTime && (
              <p className="text-sm text-muted-foreground">
                This token will be available for trading on{' '}
                {launchTime.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    );
  }

  // For other states, just render children
  return <>{children}</>;
};

export default AccessGuard;