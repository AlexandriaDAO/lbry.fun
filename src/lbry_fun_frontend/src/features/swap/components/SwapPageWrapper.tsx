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
        <div className=" mb-4">
          <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-2">
            <span className="text-pink-500">&gt;</span> <span className="text-yellow-400">[info]</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-400 text-xs">mode:</span>
            <span className="text-white text-sm">read_only</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-400 text-xs">note:</span>
            <span className="text-white text-sm">connect_wallet_to_enable_trading</span>
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
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4 mb-4">
          <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-2">
            <span className="text-pink-500">&gt;</span> <span className="text-yellow-400">[launch_pending]</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-400 text-xs">time_remaining:</span>
            <span className="text-lime-500 font-bold text-sm">{formatCountdown(countdown || 0)}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-gray-400 text-xs">launch_date:</span>
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