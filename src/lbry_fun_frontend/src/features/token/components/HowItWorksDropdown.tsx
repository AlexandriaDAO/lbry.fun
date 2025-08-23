import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const HowItWorksDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1 text-lime-500 hover:text-lime-400 font-mono text-sm transition-colors"
      >
        <span>how_it_works</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      
      {isOpen && (
        <div className="absolute top-8 left-0 z-50 bg-black border border-lime-500/50 p-4 rounded-lg shadow-2xl min-w-[400px] font-mono text-xs">
          <div className="space-y-3">
            {/* Warning */}
            <div className="text-yellow-500 font-bold text-center pb-2 border-b border-lime-500/20">
              ⚠️ V0.1 UNAUDITED - USE AT YOUR OWN RISK ⚠️
            </div>

            {/* Protocol Mechanics */}
            <div>
              <h3 className="text-lime-500 font-bold mb-2">Protocol Mechanics:</h3>
              <ul className="space-y-1 text-gray-300">
                <li>• Mint secondary tokens with ICP at fixed rate ($0.01)</li>
                <li>• Burn secondary → primary tokens + 50% ICP refund</li>
                <li>• Primary emission rate decreases at halving thresholds</li>
                <li>• Stake primary → earn ICP (99% to stakers, 1% to ALEX stakers)</li>
                <li>• Zero premine. All launch data on-chain.</li>
              </ul>
            </div>

            {/* Example */}
            <div className="pt-2 border-t border-lime-500/20">
              <h3 className="text-lime-500 font-bold mb-2">Example: From VALUE to ZERO 📉</h3>
              <ul className="space-y-1 text-gray-300">
                <li>1 ICP → 500 $VALUE (at $5 ICP)</li>
                <li>🔥 Burn 500 $VALUE → X $ZERO + 0.5 ICP back</li>
                <li>💎 Stake $ZERO → earn ICP from new VALUE minters</li>
                <li>🦍 Ape on KongSwap</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HowItWorksDropdown;