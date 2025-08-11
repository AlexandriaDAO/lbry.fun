import React, { useEffect } from 'react';

export interface TerminalNotificationProps {
  type: 'loading' | 'success' | 'error' | 'confirm';
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  onConfirm?: () => void;
}

const TerminalNotification: React.FC<TerminalNotificationProps> = ({
  type,
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
}) => {
  useEffect(() => {
    if (isOpen && type !== 'loading' && type !== 'confirm') {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, type, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '[✓]';
      case 'error':
        return '[✗]';
      case 'loading':
        return '[◊]';
      case 'confirm':
        return '[?]';
    }
  };

  const getStatusClass = () => {
    switch (type) {
      case 'success':
        return 'text-lime-500 font-bold uppercase';
      case 'error':
        return 'text-red-500 font-bold uppercase';
      case 'loading':
        return 'text-pink-500 text-xs uppercase';
      default:
        return 'text-white';
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-2xl mx-auto">
      <div className="bg-black border border-white/30 font-mono text-sm p-3 p-4">
        <div className="flex items-start gap-2">
          <span className={getStatusClass()}>{getIcon()}</span>
          <div className="flex-1">
            <div className={`font-mono text-sm ${getStatusClass()}`}>
              {title || (type === 'loading' ? 'PROCESSING' : type.toUpperCase())}
            </div>
            {message && (
              <div className="font-mono text-xs text-gray-400 mt-1">
                {message}
              </div>
            )}
          </div>
          {type === 'confirm' ? (
            <div className="flex gap-2">
              <button
                className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10 text-xs px-2 py-1"
                onClick={onClose}
              >
                CANCEL
              </button>
              <button
                className="bg-lime-500 text-black border-0 font-bold hover:bg-lime-400 font-mono text-sm px-4 py-2 w-full text-xs px-2 py-1"
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
              >
                CONFIRM
              </button>
            </div>
          ) : type !== 'loading' && (
            <button
              className="terminal-action text-xs"
              onClick={onClose}
            >
              CLOSE
            </button>
          )}
        </div>
        {type === 'loading' && (
          <div className="terminal-progress mt-3">
            <div 
              className="terminal-progress-bar"
              style={{ 
                width: '100%',
                animation: 'pulse-glow 1.5s ease-in-out infinite'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalNotification;