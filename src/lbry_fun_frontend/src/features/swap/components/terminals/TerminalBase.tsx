import React, { ReactNode } from 'react';
// import { TerminalContainer } from '@/components/terminal';

interface TerminalBaseProps {
  title: string;
  version?: string;
  children: ReactNode;
  asciiArt?: string;
  className?: string;
  showTimestamp?: boolean;
  headerButtons?: Array<{
    label: string;
    onClick: () => void;
    active?: boolean;
  }>;
}

export const TerminalBase: React.FC<TerminalBaseProps> = ({
  title,
  version = 'v1.337',
  children,
  asciiArt,
  className = '',
  showTimestamp = true,
  headerButtons
}) => {
  return (
    <div className={`bg-black border border-white/30 font-mono text-sm p-3 ${className}`}>
      {/* Terminal Header with timestamp */}
      <div className="font-mono font-bold text-white mb-1 text-sm uppercase">
        <span className="text-pink-500">&gt;&gt;</span> {title.toLowerCase().replace(/\s+/g, '_')}_{version}
        {showTimestamp && (
          <span className="text-gray-400 text-xs ml-2">
            {new Date().toTimeString().slice(0, 8)}
          </span>
        )}
      </div>

      <div className="border-t border-white/30 my-2" />

      {/* Header Buttons (if provided) */}
      {headerButtons && headerButtons.length > 0 && (
        <>
          <div className="border-t border-white/30 mt-2 pt-1">
            <span className="text-pink-500">&gt;</span> select_operation
            <div className="flex gap-2 mt-1">
              {headerButtons.map((button, index) => (
                <button
                  key={index}
                  onClick={button.onClick}
                  className={`
                    bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10 text-xs px-2 py-0.5
                    ${button.active
                      ? 'border-lime-500 text-lime-500'
                      : 'border-white/30 text-gray-400 hover:text-white hover:border-white/50'
                    }
                  `}
                >
                  [{button.label}]
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-white/30 my-2" />
        </>
      )}

      {/* Main Content */}
      <div>
        {children}
      </div>

      {/* Terminal Footer */}
      <div className="border-t border-white/30 my-2 mt-4" />
      <div className="text-xs text-gray-600">
        <span className="text-pink-500">&gt;</span> end_transmission
      </div>
    </div>
  );
};