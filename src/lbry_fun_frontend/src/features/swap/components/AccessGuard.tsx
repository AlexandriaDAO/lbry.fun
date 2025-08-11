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
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4 mb-4">
          <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-2">
            <span className="text-pink-500">&gt;</span> <span className="text-yellow-400">[auth_required]</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-400 text-xs">status:</span>
            <span className="text-white text-sm">read_only_mode</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-400 text-xs">action:</span>
            <span className="text-white text-sm">connect_wallet_to_enable_trading</span>
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
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4 mb-4">
          <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-2">
            <span className="text-pink-500">&gt;</span> <span className="text-yellow-400">[launch_pending]</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-400 text-xs">countdown:</span>
            <span className="text-lime-500 font-bold text-sm">{formatCountdown(timeRemaining)}</span>
          </div>
          {launchTime && (
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 text-xs">launch_time:</span>
              <span className="text-white text-sm">
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