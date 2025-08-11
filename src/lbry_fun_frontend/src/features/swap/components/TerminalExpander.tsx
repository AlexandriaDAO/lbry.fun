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
  const [maxHeight, setMaxHeight] = useState<string>(() => isExpanded ? 'none' : '0px');

  useEffect(() => {
    localStorage.setItem(`terminal_expanded_${terminalId}`, String(isExpanded));
  }, [isExpanded, terminalId]);

  useEffect(() => {
    const updateHeight = () => {
      if (contentRef.current) {
        if (isExpanded) {
          // Use 'none' for expanded state to allow full content display
          setMaxHeight('none');
        } else {
          setMaxHeight('0px');
        }
      }
    };

    updateHeight();

    // Set up ResizeObserver to handle dynamic content changes
    if (contentRef.current && isExpanded) {
      const resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      
      resizeObserver.observe(contentRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [isExpanded, children]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="bg-black border border-white/30 font-mono text-sm p-3">
      <div
        className="font-mono font-bold text-white mb-1 text-sm uppercase flex items-center justify-between p-4 cursor-pointer select-none transition-colors duration-200 hover:bg-lime-500/10"
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
          <span className="text-pink-500">
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
      {isExpanded && <div className="border-t border-white/30" />}
      <div
        ref={contentRef}
        id={`terminal-content-${terminalId}`}
        className="transition-all duration-300 ease-out"
        style={{ 
          maxHeight,
          overflow: isExpanded ? 'visible' : 'hidden'
        }}
      >
        {children}
      </div>
    </div>
  );
};