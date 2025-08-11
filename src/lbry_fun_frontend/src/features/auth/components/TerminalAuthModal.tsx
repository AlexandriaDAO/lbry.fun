import React, { useState } from 'react';
import { useIdentity } from '@/hooks/useIdentity';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

interface TerminalAuthModalProps {
  onClose: () => void;
}

const TerminalAuthModal: React.FC<TerminalAuthModalProps> = ({ onClose }) => {
  const { login } = useIdentity();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!login) {
      setError('Login function not available');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      await login();
      onClose();
    } catch (err) {
      setError('Connection failed');
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-black border border-white/30 font-mono text-sm p-3 max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-mono font-bold text-white mb-1 text-sm uppercase">WALLET CONNECTION</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white"
            disabled={isConnecting}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {!isConnecting ? (
          <>
            <p className="mb-4 text-gray-400">Select wallet provider:</p>
            <button
              onClick={handleConnect}
              className="bg-lime-500 text-black border-0 font-bold hover:bg-lime-400 font-mono text-sm px-4 py-2 w-full w-full mb-2"
            >
              &gt; internet_identity
            </button>
            {error && (
              <p className="text-red-500 font-bold uppercase mt-2">{error}</p>
            )}
          </>
        ) : (
          <div className="text-center">
            <FontAwesomeIcon icon={faSpinner} className="text-yellow-500 text-2xl animate-spin mb-4" />
            <p className="text-gray-400">Connecting...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { TerminalAuthModal };