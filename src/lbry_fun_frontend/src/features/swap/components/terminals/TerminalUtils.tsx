import React from 'react';

interface TerminalProgressBarProps {
  value: number;
  max: number;
  width?: number;
  showPercentage?: boolean;
  color?: 'lime' | 'cyan' | 'pink';
}

export const TerminalProgressBar: React.FC<TerminalProgressBarProps> = ({
  value,
  max,
  width = 20,
  showPercentage = true,
  color = 'lime'
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;
  
  const colorClass = {
    lime: 'text-lime-500',
    cyan: 'text-cyan-400',
    pink: 'text-pink-500'
  }[color];

  return (
    <div className="flex items-center space-x-2">
      <span className="font-mono text-xs text-gray-600">[</span>
      <span className={`font-mono text-xs ${colorClass}`}>
        {'█'.repeat(filled)}
      </span>
      <span className="font-mono text-xs text-gray-800">
        {'░'.repeat(empty)}
      </span>
      <span className="font-mono text-xs text-gray-600">]</span>
      {showPercentage && (
        <span className="font-mono text-xs text-gray-400">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
};

interface TerminalLoadingProps {
  message?: string;
}

export const TerminalLoading: React.FC<TerminalLoadingProps> = ({ 
  message = 'Loading' 
}) => {
  return (
    <div className="terminal-status-loading">
      {message}
      <span className="terminal-blink">_</span>
    </div>
  );
};

interface TerminalErrorProps {
  code: string;
  message: string;
}

export const TerminalError: React.FC<TerminalErrorProps> = ({ code, message }) => {
  return (
    <div className="terminal-error terminal-boot">
      <pre className="text-red-500 text-xs">
{`╔══════════════════════════════════════╗
║ ERROR: ${code.padEnd(29)} ║
╚══════════════════════════════════════╝`}
      </pre>
      <div className="mt-2 text-red-400 text-sm font-mono">
        <span className="terminal-prompt">!</span> {message}
      </div>
    </div>
  );
};

interface TerminalSuccessProps {
  message: string;
}

export const TerminalSuccess: React.FC<TerminalSuccessProps> = ({ message }) => {
  return (
    <div className="terminal-success terminal-pulse">
      <span className="terminal-prompt text-lime-500">✓</span> {message}
    </div>
  );
};

// ASCII Art Components
export const TerminalLogo: React.FC = () => {
  return (
    <pre className="terminal-ascii-header text-center">
{`
   __    ____  ____  _  _     _____ _  _ _  _ 
  (  )  (  _ \\(  _ \\( \\/ )   |  ___| || | \\| |
  / (_/\\ ) _ ( )   / \\  /    | |_  | || |  ' |
  \\____/(____/(__\\_) (__) ⚡ |_|   \\__/|_|\\_|
`}
    </pre>
  );
};

// Terminal Decorators
export const TerminalBoxHeader: React.FC<{ title: string }> = ({ title }) => {
  const padded = title.padEnd(36);
  return (
    <pre className="text-gray-600 text-xs mb-2">
{`┌─────────────────────────────────────┐
│ ${padded} │
└─────────────────────────────────────┘`}
    </pre>
  );
};