import React from 'react';
import { useAccessState } from '../hooks/useAccessState';
import { AccessState } from '../types/accessControl.types';
import { AlertCircle, Info } from 'lucide-react';

interface SwapPageWrapperProps {
  children: React.ReactNode;
}

const SwapPageWrapper: React.FC<SwapPageWrapperProps> = ({ children }) => {
  const { accessState, countdown, launchTime, isTokenLive } = useAccessState();

  // Render informational banner based on access state
  const renderInfoBanner = () => {
    if (accessState === AccessState.UNAUTHENTICATED) {
      return (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-foreground">
              You're viewing this token in read-only mode. Connect your wallet to enable trading features.
            </p>
          </div>
        </div>
      );
    }

    if (accessState === AccessState.AWAITING_LAUNCH && launchTime) {
      const formatCountdown = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours} hours and ${minutes} minutes`;
      };

      return (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-foreground">
              This token is in its launch period. Trading will be enabled in{' '}
              <span className="font-semibold">{formatCountdown(countdown || 0)}</span> at{' '}
              {launchTime.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              })}.
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      {renderInfoBanner()}
      {children}
    </div>
  );
};

export default SwapPageWrapper;