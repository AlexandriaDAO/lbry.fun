import React from 'react';
import { useAccessState } from '../hooks/useAccessState';
import { AccessState } from '../types/accessControl.types';

interface SwapPageWrapperProps {
  children: React.ReactNode;
}

const SwapPageWrapper: React.FC<SwapPageWrapperProps> = ({ children }) => {
  const { accessState, countdown, launchTime, isTokenLive } = useAccessState();

  // Render informational banner based on access state
  const renderInfoBanner = () => {
    if (accessState === AccessState.UNAUTHENTICATED) {
      return (
        <div className="terminal-info mb-4">
          <div className="terminal-header mb-2">
            <span className="terminal-prompt">&gt;</span> <span className="terminal-status">[info]</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">mode:</span>
            <span className="terminal-value">read_only</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">note:</span>
            <span className="terminal-value">connect_wallet_to_enable_trading</span>
          </div>
        </div>
      );
    }

    if (accessState === AccessState.AWAITING_LAUNCH && launchTime) {
      const formatCountdown = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
      };

      return (
        <div className="terminal-warning mb-4">
          <div className="terminal-header mb-2">
            <span className="terminal-prompt">&gt;</span> <span className="terminal-status">[launch_pending]</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">time_remaining:</span>
            <span className="terminal-primary">{formatCountdown(countdown || 0)}</span>
          </div>
          <div className="terminal-row">
            <span className="terminal-label">launch_date:</span>
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