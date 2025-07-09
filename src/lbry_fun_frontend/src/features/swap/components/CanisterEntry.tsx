import React from 'react';
import UnifiedInfoDisplay from './UnifiedInfoDisplay';
import CopyHelper from './CopyHelper';
import { CanisterLogs } from './CanisterLogs';
import { CanisterStats } from './CanisterStats';
import { CanisterType } from '@/actors/canisterActorFactory';

interface CanisterEntryProps {
    label: string;
    canisterId: string;
    showLogs?: boolean;
    showStats?: boolean;
    canisterType?: CanisterType;
    compactMode?: boolean;
    cycleData?: { cycles: string; loading: boolean };
    getCycleHealthColor?: (cycles: string | undefined) => string;
}

export const CanisterEntry: React.FC<CanisterEntryProps> = ({
    label,
    canisterId,
    showLogs = false,
    showStats = false,
    canisterType,
    compactMode = false,
    cycleData,
    getCycleHealthColor = () => 'text-gray-400'
}) => {
    const shortenCanisterId = (id: string) => {
        return `${id.slice(0, 6)}...${id.slice(-6)}`;
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="terminal-label w-[140px]">{label}:</span>
                    <span className="hex-address font-mono" title={canisterId}>
                        {shortenCanisterId(canisterId)}
                    </span>
                </div>
                <span className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                    <CopyHelper account={canisterId} />
                </span>
            </div>
            
            {!compactMode && (
                <>
                    {cycleData ? (
                        <div className="flex items-center justify-between pl-8">
                            <div className="flex items-center gap-4">
                                <span className="terminal-label w-[116px]">cycles:</span>
                                <span className={`font-mono ${getCycleHealthColor(cycleData.cycles)} ${cycleData.loading ? 'animate-pulse' : ''}`}>
                                    {cycleData.loading ? 'Loading...' : cycleData.cycles}
                                </span>
                            </div>
                            {!cycleData.loading && cycleData.cycles.includes('T') && (
                                <span className="text-xs text-gray-500" title="T = Trillion cycles">
                                    1T = 1 trillion cycles
                                </span>
                            )}
                        </div>
                    ) : (
                        <UnifiedInfoDisplay 
                            variant="cycles" 
                            canisterId={canisterId} 
                        />
                    )}
                    
                    {(showLogs || showStats) && (
                        <div className="flex items-center justify-between pl-8">
                            <div className="flex items-center gap-4">
                                <span className="terminal-label w-[116px]"></span>
                            </div>
                            <div className="flex items-center gap-2">
                                {showLogs && canisterType && (
                                    <CanisterLogs 
                                        canisterId={canisterId}
                                        canisterName={label.charAt(0).toUpperCase() + label.slice(1).replace('_', ' ')}
                                        canisterType={canisterType}
                                    />
                                )}
                                {showStats && canisterType && (
                                    <CanisterStats 
                                        canisterId={canisterId}
                                        canisterName={label.charAt(0).toUpperCase() + label.slice(1).replace('_', ' ')}
                                        canisterType={canisterType as 'tokenomics' | 'icp_swap'}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};