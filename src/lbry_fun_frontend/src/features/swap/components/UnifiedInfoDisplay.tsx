import React, { useEffect, useState, useCallback } from 'react';
import { Principal } from '@dfinity/principal';
import { getLbryFunActor } from '@/features/auth/utils/authUtils';
import { toast } from 'sonner';
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { CanisterLogs } from "./CanisterLogs";
import CopyHelper from "./CopyHelper";
import { CanisterStats } from "./CanisterStats";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate, faCopy, faCompress, faExpand } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/lib/components/button';
import { CanisterEntry } from './CanisterEntry';

interface UnifiedInfoDisplayProps {
    variant: 'card' | 'cycles' | 'stats' | 'developer';
    data?: Record<string, string | number | boolean>;
    title?: string;
    // For cycles variant
    canisterId?: string;
    // For developer variant (replaces InfoCard)
    showDeveloperInfo?: boolean;
}

const UnifiedInfoDisplay: React.FC<UnifiedInfoDisplayProps> = ({ 
    variant, 
    data = {}, 
    title,
    canisterId,
    showDeveloperInfo = false
}) => {
    const [cycles, setCycles] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [compactMode, setCompactMode] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [cycleData, setCycleData] = useState<Record<string, { cycles: string; loading: boolean }>>({});
    const { activeSwapPool: activeSwapPoolFromRedux } = useAppSelector((state) => state.swap);

    const shortenCanisterId = (id: string) => {
        return `${id.slice(0, 6)}...${id.slice(-6)}`;
    };

    // Fetch cycles for cycles variant
    useEffect(() => {
        if (variant === 'cycles' && canisterId) {
            const fetchCycles = async () => {
                if (!canisterId) {
                    setLoading(false);
                    setError("Canister ID not provided.");
                    return;
                }
                try {
                    setLoading(true);
                    const actor = await getLbryFunActor();
                    const principal = Principal.fromText(canisterId);
                    const result = await actor.get_canister_cycle_balance(principal);
                    if ('Ok' in result) {
                        const cyclesValue = BigInt(result.Ok.toString());
                        setCycles(new Intl.NumberFormat().format(cyclesValue));
                    } else {
                        throw new Error(result.Err);
                    }
                } catch (err) {
                    console.error(`Failed to fetch cycles for ${canisterId}:`, err);
                    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
                    setError(errorMessage);
                    toast.error(`Failed to fetch cycles for ${canisterId}: ${errorMessage}`);
                } finally {
                    setLoading(false);
                }
            };

            fetchCycles();
        }
    }, [variant, canisterId]);

    // Card variant - generic info card
    if (variant === 'card') {
        return (
            <div className="bg-black border border-white/30 font-mono text-sm p-3">
                {title && (
                    <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-2">
                        <span className="text-pink-500">&gt;&gt;</span> {title}
                    </div>
                )}
                <div className="">
                    {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center py-0.5">
                            <span className="text-gray-400 text-xs">{key}:</span>
                            <span className="text-white text-sm">{String(value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Cycles variant - shows canister cycles (replaces CanisterCycles component)
    if (variant === 'cycles' && canisterId) {
        return (
            <div className="flex items-center justify-between pl-8">
                <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-xs w-[116px]">cycles:</span>
                    <span className="text-gray-600 text-xs font-mono">
                        {loading && "loading..."}
                        {error && <span className="text-red-400">[ERROR]</span>}
                        {cycles !== null && !loading && !error && `${cycles} T`}
                    </span>
                </div>
                <span className="text-xs text-gray-500">
                    {cycles !== null && !loading && !error && '1T = 1 trillion cycles'}
                </span>
            </div>
        );
    }

    // Stats variant - for displaying statistics
    if (variant === 'stats') {
        return (
            <div className="bg-black border border-white/30 font-mono text-sm p-3">
                {title && (
                    <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-2">
                        <span className="text-pink-500">&gt;&gt;</span> {title}
                    </div>
                )}
                <div className="">
                    {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center py-0.5">
                            <span className="text-gray-400 text-xs">{key}:</span>
                            <span className="text-lime-500 font-bold text-sm">{String(value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Helper function to get cycle health color
    const getCycleHealthColor = (cyclesStr: string | undefined): string => {
        if (!cyclesStr || cyclesStr === '') return 'text-gray-400';
        const match = cyclesStr.match(/([\d,]+(?:\.\d+)?)/);
        if (!match) return 'text-gray-400';
        const cycles = parseFloat(match[1].replace(/,/g, ''));
        if (cycles < 0.5) return 'text-red-500';
        if (cycles < 1) return 'text-yellow-500';
        return 'text-green-500';
    };

    // Helper function to copy all canister IDs
    const copyAllCanisterIds = useCallback(async () => {
        if (!activeSwapPoolFromRedux) return;
        
        const ids = {
            icp_swap: activeSwapPoolFromRedux[1].icp_swap_canister_id,
            tokenomics: activeSwapPoolFromRedux[1].tokenomics_canister_id,
            logs: activeSwapPoolFromRedux[1].logs_canister_id,
            primary_token: activeSwapPoolFromRedux[1].primary_token_id,
            secondary_token: activeSwapPoolFromRedux[1].secondary_token_id
        };
        
        try {
            await navigator.clipboard.writeText(JSON.stringify(ids, null, 2));
            toast.success('All canister IDs copied to clipboard');
        } catch (error) {
            toast.error('Failed to copy canister IDs');
        }
    }, [activeSwapPoolFromRedux]);

    // Refresh all cycle balances
    const refreshAllCycles = useCallback(async () => {
        if (!activeSwapPoolFromRedux || refreshing) return;
        
        setRefreshing(true);
        const canisterIds = [
            activeSwapPoolFromRedux[1].icp_swap_canister_id,
            activeSwapPoolFromRedux[1].tokenomics_canister_id,
            activeSwapPoolFromRedux[1].logs_canister_id,
            activeSwapPoolFromRedux[1].primary_token_id,
            activeSwapPoolFromRedux[1].secondary_token_id
        ];

        try {
            const actor = await getLbryFunActor();
            const promises = canisterIds.map(async (id) => {
                setCycleData(prev => ({ 
                    ...prev, 
                    [id]: { 
                        cycles: prev[id]?.cycles || '', 
                        loading: true 
                    } 
                }));
                try {
                    const principal = Principal.fromText(id);
                    const result = await actor.get_canister_cycle_balance(principal);
                    if ('Ok' in result) {
                        const cyclesValue = Number(result.Ok) / 1e12;
                        setCycleData(prev => ({ 
                            ...prev, 
                            [id]: { cycles: `${cyclesValue.toLocaleString()} T`, loading: false } 
                        }));
                    }
                } catch (err) {
                    setCycleData(prev => ({ ...prev, [id]: { cycles: 'Error', loading: false } }));
                }
            });
            
            await Promise.all(promises);
            toast.success('Cycle balances refreshed');
        } catch (error) {
            toast.error('Failed to refresh cycle balances');
        } finally {
            setRefreshing(false);
        }
    }, [activeSwapPoolFromRedux, refreshing]);

    // Developer variant - full developer info (replaces InfoCard component)
    if (variant === 'developer') {
        return (
            <div className="w-full p-4">
                {activeSwapPoolFromRedux ? (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold">Canister Registry</h3>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    scale="sm"
                                    onClick={copyAllCanisterIds}
                                    className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10"
                                    title="Copy all canister IDs as JSON"
                                >
                                    <FontAwesomeIcon icon={faCopy} className="mr-2" />
                                    Copy All
                                </Button>
                                <Button
                                    variant="outline"
                                    scale="sm"
                                    onClick={refreshAllCycles}
                                    disabled={refreshing}
                                    className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10"
                                    title="Refresh all cycle balances"
                                >
                                    <FontAwesomeIcon icon={faRotate} className={refreshing ? 'animate-spin' : ''} />
                                </Button>
                                <Button
                                    variant="outline"
                                    scale="sm"
                                    onClick={() => setCompactMode(!compactMode)}
                                    className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10"
                                    title={compactMode ? 'Expand view' : 'Compact view'}
                                >
                                    <FontAwesomeIcon icon={compactMode ? faExpand : faCompress} />
                                </Button>
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                            {/* System Canisters Group */}
                            <div className="space-y-4">
                                <h4 className="text-sm text-gray-400 uppercase tracking-wider">System Canisters</h4>
                                
                                <CanisterEntry
                                    label="icp_swap"
                                    canisterId={activeSwapPoolFromRedux[1].icp_swap_canister_id}
                                    showLogs={true}
                                    showStats={true}
                                    canisterType="icp_swap"
                                    compactMode={compactMode}
                                    cycleData={cycleData[activeSwapPoolFromRedux[1].icp_swap_canister_id]}
                                    getCycleHealthColor={getCycleHealthColor}
                                />

                                <CanisterEntry
                                    label="tokenomics"
                                    canisterId={activeSwapPoolFromRedux[1].tokenomics_canister_id}
                                    showLogs={true}
                                    showStats={true}
                                    canisterType="tokenomics"
                                    compactMode={compactMode}
                                    cycleData={cycleData[activeSwapPoolFromRedux[1].tokenomics_canister_id]}
                                    getCycleHealthColor={getCycleHealthColor}
                                />

                                <CanisterEntry
                                    label="logs"
                                    canisterId={activeSwapPoolFromRedux[1].logs_canister_id}
                                    showLogs={false}
                                    showStats={false}
                                    compactMode={compactMode}
                                    cycleData={cycleData[activeSwapPoolFromRedux[1].logs_canister_id]}
                                    getCycleHealthColor={getCycleHealthColor}
                                />
                            </div>

                            {/* Token Canisters Group */}
                            <div className="space-y-4">
                                <h4 className="text-sm text-gray-400 uppercase tracking-wider">Token Canisters</h4>
                                
                                <CanisterEntry
                                    label="primary_token"
                                    canisterId={activeSwapPoolFromRedux[1].primary_token_id}
                                    showLogs={false}
                                    showStats={false}
                                    compactMode={compactMode}
                                    cycleData={cycleData[activeSwapPoolFromRedux[1].primary_token_id]}
                                    getCycleHealthColor={getCycleHealthColor}
                                />

                                <CanisterEntry
                                    label="secondary_token"
                                    canisterId={activeSwapPoolFromRedux[1].secondary_token_id}
                                    showLogs={false}
                                    showStats={false}
                                    compactMode={compactMode}
                                    cycleData={cycleData[activeSwapPoolFromRedux[1].secondary_token_id]}
                                    getCycleHealthColor={getCycleHealthColor}
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/10">
                            <div className="space-y-1">
                                <div className="flex justify-between items-center py-0.5">
                                    <span className="text-gray-400 text-xs">status:</span>
                                    <span className="text-lime-500 font-bold text-sm">[ACTIVE]</span>
                                </div>
                                <div className="flex justify-between items-center py-0.5">
                                    <span className="text-gray-400 text-xs">network:</span>
                                    <span className="text-white text-sm">internet_computer</span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-muted-foreground">
                        <p>No active pool selected. Select a pool to view technical details.</p>
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default UnifiedInfoDisplay;