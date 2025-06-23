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

  // Render restricted access overlay
  return (
    <div className="relative">
      {/* Blurred background content */}
      <div className="opacity-30 blur-sm pointer-events-none select-none">
        {children}
      </div>

      {/* Access restriction overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full shadow-xl">
          {accessState === AccessState.UNAUTHENTICATED ? (
            <>
              <div className="flex flex-col items-center text-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Connect to Trade</h3>
                <p className="text-muted-foreground mb-6">
                  View live rates and stats while exploring this token. Connect your wallet to enable trading.
                </p>
                <div className="w-full">
                  <Entry />
                </div>
              </div>
            </>
          ) : accessState === AccessState.AWAITING_LAUNCH ? (
            <>
              <div className="flex flex-col items-center text-center">
                <div className="bg-yellow-500/10 p-4 rounded-full mb-4">
                  <Clock className="w-8 h-8 text-yellow-500" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Launching Soon!</h3>
                
                {timeRemaining > 0 && (
                  <div className="text-3xl font-mono font-bold text-primary mb-4">
                    {formatCountdown(timeRemaining)}
                  </div>
                )}
                
                {launchTime && (
                  <p className="text-muted-foreground mb-6">
                    Trading starts at<br />
                    <span className="text-foreground font-medium">
                      {launchTime.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short'
                      })}
                    </span>
                  </p>
                )}
                
                <div className="flex gap-3 w-full">
                  <button className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                    Set Reminder
                  </button>
                  <button className="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AccessGuard;