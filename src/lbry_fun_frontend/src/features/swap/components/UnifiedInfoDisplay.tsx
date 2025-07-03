import React, { useEffect, useState } from 'react';
import { Principal } from '@dfinity/principal';
import { getLbryFunActor } from '@/features/auth/utils/authUtils';
import { toast } from 'sonner';
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { CanisterLogs } from "./CanisterLogs";

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
            <div className="terminal-pure">
                {title && (
                    <div className="terminal-header mb-2">
                        <span className="terminal-prompt">&gt;&gt;</span> {title}
                    </div>
                )}
                <div className="terminal-info">
                    {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="terminal-row">
                            <span className="terminal-label">{key}:</span>
                            <span className="terminal-value">{String(value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Cycles variant - shows canister cycles (replaces CanisterCycles component)
    if (variant === 'cycles' && canisterId) {
        return (
            <div className="terminal-row pl-4">
                <span className="terminal-label text-xs">cycles:</span>
                <span className="terminal-accent text-xs">
                    {loading && "loading..."}
                    {error && <span className="terminal-status">[ERROR]</span>}
                    {cycles !== null && !loading && !error && `${cycles} T`}
                </span>
            </div>
        );
    }

    // Stats variant - for displaying statistics
    if (variant === 'stats') {
        return (
            <div className="terminal-pure">
                {title && (
                    <div className="terminal-header mb-2">
                        <span className="terminal-prompt">&gt;&gt;</span> {title}
                    </div>
                )}
                <div className="terminal-section-minimal">
                    {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="terminal-row">
                            <span className="terminal-label">{key}:</span>
                            <span className="terminal-primary">{String(value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Developer variant - full developer info (replaces InfoCard component)
    if (variant === 'developer') {
        return (
            <div className="w-full p-4">
                {activeSwapPoolFromRedux ? (
                    <>
                        <h3 className="text-lg font-semibold mb-6">Canister Registry</h3>
                        
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <div className="terminal-row">
                                    <span className="terminal-label">icp_swap:</span>
                                    <span className="hex-address" title={activeSwapPoolFromRedux[1].icp_swap_canister_id}>
                                        {shortenCanisterId(activeSwapPoolFromRedux[1].icp_swap_canister_id)}
                                    </span>
                                </div>
                                <UnifiedInfoDisplay 
                                    variant="cycles" 
                                    canisterId={activeSwapPoolFromRedux[1].icp_swap_canister_id} 
                                />
                                <div className="terminal-row pl-4">
                                    <CanisterLogs 
                                        canisterId={activeSwapPoolFromRedux[1].icp_swap_canister_id}
                                        canisterName="ICP Swap"
                                        canisterType="icp_swap"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="terminal-row">
                                    <span className="terminal-label">tokenomics:</span>
                                    <span className="hex-address" title={activeSwapPoolFromRedux[1].tokenomics_canister_id}>
                                        {shortenCanisterId(activeSwapPoolFromRedux[1].tokenomics_canister_id)}
                                    </span>
                                </div>
                                <UnifiedInfoDisplay 
                                    variant="cycles" 
                                    canisterId={activeSwapPoolFromRedux[1].tokenomics_canister_id} 
                                />
                                <div className="terminal-row pl-4">
                                    <CanisterLogs 
                                        canisterId={activeSwapPoolFromRedux[1].tokenomics_canister_id}
                                        canisterName="Tokenomics"
                                        canisterType="tokenomics"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="terminal-row">
                                    <span className="terminal-label">logs:</span>
                                    <span className="hex-address" title={activeSwapPoolFromRedux[1].logs_canister_id}>
                                        {shortenCanisterId(activeSwapPoolFromRedux[1].logs_canister_id)}
                                    </span>
                                </div>
                                <UnifiedInfoDisplay 
                                    variant="cycles" 
                                    canisterId={activeSwapPoolFromRedux[1].logs_canister_id} 
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="terminal-row">
                                    <span className="terminal-label">primary_token:</span>
                                    <span className="hex-address" title={activeSwapPoolFromRedux[1].primary_token_id}>
                                        {shortenCanisterId(activeSwapPoolFromRedux[1].primary_token_id)}
                                    </span>
                                </div>
                                <UnifiedInfoDisplay 
                                    variant="cycles" 
                                    canisterId={activeSwapPoolFromRedux[1].primary_token_id} 
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="terminal-row">
                                    <span className="terminal-label">secondary_token:</span>
                                    <span className="hex-address" title={activeSwapPoolFromRedux[1].secondary_token_id}>
                                        {shortenCanisterId(activeSwapPoolFromRedux[1].secondary_token_id)}
                                    </span>
                                </div>
                                <UnifiedInfoDisplay 
                                    variant="cycles" 
                                    canisterId={activeSwapPoolFromRedux[1].secondary_token_id} 
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/10">
                            <div className="space-y-1">
                                <div className="terminal-row">
                                    <span className="terminal-label">status:</span>
                                    <span className="terminal-primary">[ACTIVE]</span>
                                </div>
                                <div className="terminal-row">
                                    <span className="terminal-label">network:</span>
                                    <span className="terminal-value">internet_computer</span>
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