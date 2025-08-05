import React, { useEffect, useState } from 'react';
import { Lock, Clock, AlertCircle } from 'lucide-react';
import { AccessState, AccessGuardProps } from '../types/accessControl.types';
import { TerminalAuthMenu } from '@/features/auth/components/TerminalAuthMenu';
import { formatCountdown } from '@/utils/tokenStatus';

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


  // For non-authenticated users, show a terminal-style banner
  if (accessState === AccessState.UNAUTHENTICATED) {
    return (
      <div>
        <div className="terminal-warning mb-4">
          <div className="terminal-header mb-2">
            <span className="terminal-prompt">&gt;</span> <span className="terminal-status">[auth_required]</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">status:</span>
            <span className="terminal-value">read_only_mode</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">action:</span>
            <span className="terminal-value">connect_wallet_to_enable_trading</span>
          </div>
          <div className="mt-2">
            <TerminalAuthMenu />
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
        <div className="terminal-warning mb-4">
          <div className="terminal-header mb-2">
            <span className="terminal-prompt">&gt;</span> <span className="terminal-status">[launch_pending]</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">countdown:</span>
            <span className="terminal-primary">{formatCountdown(timeRemaining)}</span>
          </div>
          {launchTime && (
            <div className="terminal-row">
              <span className="terminal-label">launch_time:</span>
              <span className="terminal-value">
                {launchTime.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}
              </span>
            </div>
          )}
        </div>
        {children}
      </div>
    );
  }

  // For other states, just render children
  return <>{children}</>;
};

export default AccessGuard;