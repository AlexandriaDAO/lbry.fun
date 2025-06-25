import React from 'react';
import { TerminalAuthMenu } from '@/features/auth/components/TerminalAuthMenu';

const TerminalHeader: React.FC = () => {
  return (
    <header className="terminal-pure sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex justify-end">
          <TerminalAuthMenu />
        </div>
      </div>
    </header>
  );
};

export default TerminalHeader;