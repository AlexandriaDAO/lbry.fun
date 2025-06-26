import React from 'react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useLogout } from '@/hooks/useLogout';
import CopyHelper from '@/features/swap/components/CopyHelper';
import { TerminalAuthModal } from './TerminalAuthModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPowerOff, faWallet } from '@fortawesome/free-solid-svg-icons';
import { useIcpBalance } from '@/hooks/useIcpBalance';

const TerminalAuthMenu: React.FC = () => {
  const logout = useLogout();
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const principal = useAppSelector((state) => state.auth.principal);
  const { balance } = useIcpBalance();

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
      <span className="terminal-primary">{balance || "0.00"} ICP</span>
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