import React from 'react';
import { Link } from 'react-router-dom';
import { TerminalAuthMenu } from '@/features/auth/components/TerminalAuthMenu';

const TerminalHeader: React.FC = () => {
  return (
    <header className="bg-black border border-white/30 font-mono text-sm p-3 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex flex-col no-underline">
            <h1 className="text-6xl font-black tracking-widest text-lime-500 font-bold text-sm font-mono hover:text-green-400 transition-colors" style={{fontWeight: 900}}>
              LBRY_FUN
            </h1>
            <span className="text-[10px] text-gray-600 text-xs opacity-60">
              Powered by Alexandria
            </span>
          </Link>
          <TerminalAuthMenu />
        </div>
      </div>
    </header>
  );
};

export default TerminalHeader;