import React, { useState, useEffect, useRef } from 'react';

interface TerminalExpanderProps {
  title: string;
  status?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  terminalId: string;
}

export const TerminalExpander: React.FC<TerminalExpanderProps> = ({
  title,
  status,
  children,
  defaultExpanded = true,
  terminalId,
}) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return false; // Default to closed during SSR
    }
    const stored = localStorage.getItem(`terminal_expanded_${terminalId}`);
    return stored !== null ? stored === 'true' : defaultExpanded;
  });
  
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<string>(() => isExpanded ? '9999px' : '0px');

  useEffect(() => {
    localStorage.setItem(`terminal_expanded_${terminalId}`, String(isExpanded));
  }, [isExpanded, terminalId]);

  useEffect(() => {
    if (contentRef.current) {
      setMaxHeight(isExpanded ? `${contentRef.current.scrollHeight}px` : '0px');
    }
  }, [isExpanded, children]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="terminal-pure terminal-flicker">
      <div
        className="terminal-header flex items-center justify-between p-4 cursor-pointer select-none transition-colors duration-200 hover:bg-lime-500/10"
        onClick={toggleExpanded}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`terminal-content-${terminalId}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <div className="flex items-center gap-2">
          <span className="terminal-prompt">
            {isExpanded ? '<<' : '>>'}
          </span>
          <span className="text-white font-mono uppercase">
            {title}
          </span>
          {status && (
            <span className="text-pink-400 font-mono">
              {status}
            </span>
          )}
        </div>
      </div>
      {isExpanded && <div className="terminal-divider-single" />}
      <div
        ref={contentRef}
        id={`terminal-content-${terminalId}`}
        className="terminal-expander-content overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight }}
      >
        {children}
      </div>
    </div>
  );
};