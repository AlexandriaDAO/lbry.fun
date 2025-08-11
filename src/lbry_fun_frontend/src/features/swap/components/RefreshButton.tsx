import React, { useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  label?: string;
  toastMessage?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  label = 'refresh',
  toastMessage = '[REFRESHING] UPDATE IN PROGRESS',
  className = '',
  size = 'xs',
  showLabel = false
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasRefreshed, setHasRefreshed] = useState(false);

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base'
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    toast.info(toastMessage);

    try {
      await onRefresh();
      setHasRefreshed(true);
      setTimeout(() => setHasRefreshed(false), 2000);
    } catch (error) {
      toast.error('[ERROR] REFRESH FAILED');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh, toastMessage]);

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${className}`}
      title={isRefreshing ? 'Refreshing...' : `Refresh ${label}`}
    >
      {showLabel && <span className="mr-2">{label}</span>}
      <FontAwesomeIcon 
        icon={faRotate} 
        className={`
          transition-all duration-300
          ${isRefreshing ? 'animate-spin text-cyan-400' : ''}
          ${hasRefreshed && !isRefreshing ? 'text-green-400' : ''}
          ${!isRefreshing && !hasRefreshed ? 'text-pink-500 hover:text-pink-400' : ''}
        `}
      />
    </button>
  );
};

export default RefreshButton;