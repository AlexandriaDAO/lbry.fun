import React from 'react';
import TooltipIcon from '@/features/token/components/TooltipIcon';

interface TerminalSectionProps {
  title: string;
  children: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const TerminalSection: React.FC<TerminalSectionProps> = ({ 
  title, 
  children,
  rightElement 
}) => {
  return (
    <div className="border border-white/30 p-4 bg-black">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-mono text-pink-500 uppercase">[{title}]</h3>
        {rightElement}
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
};

interface TerminalRowProps {
  label: string;
  value?: string | number | React.ReactNode;
  unit?: string;
  accent?: boolean;
  children?: React.ReactNode;
  tooltip?: string;
}

export const TerminalRow: React.FC<TerminalRowProps> = ({ 
  label, 
  value, 
  unit,
  accent = false,
  children,
  tooltip 
}) => {
  return (
    <div className="flex justify-between items-center font-mono text-sm">
      <span className="text-gray-400">{label}:</span>
      <div className="flex items-center gap-1">
        {children || (
          <span className={accent ? "text-cyan-400" : "text-white"}>
            {value !== undefined ? value : 'N/A'}
            {unit && ` ${unit}`}
          </span>
        )}
        {tooltip && (
          <TooltipIcon text={tooltip} />
        )}
      </div>
    </div>
  );
};

interface TerminalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TerminalInput: React.FC<TerminalInputProps> = ({ 
  error = false,
  className = '',
  ...props 
}) => {
  return (
    <input
      className={`bg-black border ${error ? 'border-red-500' : 'border-white/30'} text-white font-mono text-sm px-2 py-1 w-full focus:outline-none focus:border-cyan-400 ${className}`}
      {...props}
    />
  );
};

interface TerminalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const TerminalButton: React.FC<TerminalButtonProps> = ({ 
  primary = false,
  loading = false,
  disabled = false,
  children,
  className = '',
  ...props 
}) => {
  const baseClass = "font-mono text-sm px-4 py-2 transition-colors uppercase w-full";
  const variantClass = primary 
    ? "bg-pink-500 text-black hover:bg-pink-400 disabled:bg-gray-700 disabled:text-gray-400"
    : "bg-black border border-white/30 text-white hover:bg-white/10 disabled:text-gray-600 disabled:border-gray-700";
  
  return (
    <button
      className={`${baseClass} ${variantClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '[PROCESSING...]' : children}
    </button>
  );
};