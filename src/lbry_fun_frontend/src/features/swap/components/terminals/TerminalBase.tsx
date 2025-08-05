import React, { ReactNode } from 'react';

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
  // Default ASCII art if none provided
  const defaultAsciiArt = `╔══════════════════════════════════════╗
║     ${title.toUpperCase().padEnd(32)} ║
╚══════════════════════════════════════╝`;

  return (
    <div className={`terminal-pure terminal-flicker ${className}`}>
      {/* ASCII Art Header */}
      <pre className="terminal-ascii-header">
        {asciiArt || defaultAsciiArt}
      </pre>

      {/* Terminal Header with timestamp */}
      <div className="terminal-header terminal-boot">
        <span className="terminal-prompt">&gt;&gt;</span> {title.toLowerCase().replace(/\s+/g, '_')}_{version}
        {showTimestamp && (
          <span className="terminal-timestamp ml-2">
            {new Date().toTimeString().slice(0, 8)}
          </span>
        )}
      </div>

      <div className="terminal-divider-single" />

      {/* Header Buttons (if provided) */}
      {headerButtons && headerButtons.length > 0 && (
        <>
          <div className="terminal-section terminal-boot" style={{ animationDelay: '0.1s' }}>
            <span className="terminal-prompt">&gt;</span> select_operation
            <div className="flex gap-2 mt-1">
              {headerButtons.map((button, index) => (
                <button
                  key={index}
                  onClick={button.onClick}
                  className={`
                    terminal-button text-xs px-2 py-0.5
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
          <div className="terminal-divider-single" />
        </>
      )}

      {/* Main Content */}
      <div className="terminal-content">
        {children}
      </div>

      {/* Terminal Footer */}
      <div className="terminal-divider-single mt-4" />
      <div className="terminal-footer text-xs text-gray-600">
        <span className="terminal-prompt">&gt;</span> end_transmission
      </div>
    </div>
  );
};