import React, { useCallback } from 'react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useLogout } from '@/hooks/useLogout';
import CopyHelper from '@/features/swap/components/CopyHelper';
import { TerminalAuthModal } from './TerminalAuthModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPowerOff, faWallet, faRotate } from '@fortawesome/free-solid-svg-icons';
import { useIcpBalance } from '@/hooks/useIcpBalance';
import { useRefreshableData } from '@/hooks/useRefreshableData';
import getIcpBal from '@/features/icp-ledger/thunks/getIcpBal';

const TerminalAuthMenu: React.FC = () => {
  const logout = useLogout();
  const dispatch = useAppDispatch();
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const principal = useAppSelector((state) => state.auth.principal);
  const { balance } = useIcpBalance();
  
  // Memoize fetcher to prevent recreating every render
  const fetchBalance = useCallback(
    () => dispatch(getIcpBal(principal!)),
    [dispatch, principal]
  );
  
  const { isRefreshing, refresh } = useRefreshableData(
    'icp-balance',
    fetchBalance,
    [principal],
    { autoRefresh: 30000 } // Auto-refresh every 30s
  );

  const formatPrincipal = (p: string | null) => {
    if (!p) return 'unknown';
    if (p.length > 16) {
      return `${p.slice(0, 6)}...${p.slice(-6)}`;
    }
    return p;
  };

  if (!isAuthenticated) {
    return (
      <>
        <button
          onClick={() => setShowAuthModal(true)}
          className="terminal-button-primary px-4 py-2"
        >
          <FontAwesomeIcon icon={faWallet} className="mr-2" />
          <span>&gt; connect_wallet</span>
        </button>
        {showAuthModal && <TerminalAuthModal onClose={() => setShowAuthModal(false)} />}
      </>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="terminal-status-live">[CONNECTED]</span>
      <span className={`terminal-primary ${isRefreshing ? 'opacity-50' : ''}`}>
        {balance || "0.00"} ICP
      </span>
      <FontAwesomeIcon 
        icon={faRotate}
        className={`cursor-pointer text-xs transition-all ${
          isRefreshing 
            ? 'animate-spin text-cyan-400' 
            : 'text-pink-500 hover:text-pink-400 hover:rotate-180'
        }`}
        onClick={refresh}
        title={isRefreshing ? 'Refreshing...' : 'Refresh balance'}
      />
      <div className="flex items-center gap-2">
        <span className="hex-address">{formatPrincipal(principal)}</span>
        {principal && <CopyHelper account={principal} />}
      </div>
      <button
        onClick={logout}
        className="terminal-button px-2 py-1"
      >
        <FontAwesomeIcon icon={faPowerOff} />
      </button>
    </div>
  );
};

export { TerminalAuthMenu };