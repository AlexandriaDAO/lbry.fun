import React, { useMemo, lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import UnifiedSkeleton from './UnifiedSkeleton';

// Lazy load the tokenomics graphs
const UnifiedTokenomicsGraphs = lazy(() => import('@/features/token/components/UnifiedTokenomicsGraphs'));

const TokenomicsTab: React.FC = () => {
    const { swap } = useAppSelector(state => state);
    const poolData = swap.activeSwapPool;
    const rawTokenomicsSchedule = swap.tokenomicsSchedule;
    const tokenomicsCurrentState = swap.tokenomicsCurrentState;
    
    // Convert BigUint64Array to regular array if needed
    const tokenomicsSchedule = rawTokenomicsSchedule ? {
        primary_mint_per_threshold: Array.isArray(rawTokenomicsSchedule.primary_mint_per_threshold) 
            ? rawTokenomicsSchedule.primary_mint_per_threshold 
            : Array.from(rawTokenomicsSchedule.primary_mint_per_threshold).map(v => v.toString()),
        secondary_burn_per_threshold: Array.isArray(rawTokenomicsSchedule.secondary_burn_per_threshold)
            ? rawTokenomicsSchedule.secondary_burn_per_threshold
            : Array.from(rawTokenomicsSchedule.secondary_burn_per_threshold).map(v => v.toString())
    } : null;

    // Calculate tokenomics values using useMemo to avoid recalculation
    const tokenomicsValues = useMemo(() => {
        const poolTokenomics = poolData?.[1];
        if (!poolTokenomics) {
            return null;
        }

        const E8S = 100_000_000n;
        const primaryMaxSupply = (BigInt(poolTokenomics.primary_token_max_supply || "0") / E8S).toString();
        const tgeAllocation = (BigInt(poolTokenomics.initial_primary_mint || "0") / E8S).toString();
        const initialSecondaryBurn = (BigInt(poolTokenomics.initial_secondary_burn || "0") / E8S).toString();
        const halvingStep = poolTokenomics.halving_step?.toString() || "0";
        
        // Get initial reward per burn unit from the fetched schedule or calculate it
        let initialRewardPerBurnUnit = "1";
        if (tokenomicsSchedule && tokenomicsSchedule.primary_mint_per_threshold && tokenomicsSchedule.primary_mint_per_threshold.length > 0) {
            // Handle both string and BigUint64Array types
            const firstValue = tokenomicsSchedule.primary_mint_per_threshold[0];
            const firstRewardE8s = BigInt(firstValue.toString());
            initialRewardPerBurnUnit = (firstRewardE8s / E8S).toString();
        } else {
            // Calculate it based on the formula if schedule not available yet
            const tgeE8s = BigInt(poolTokenomics.initial_primary_mint || "0");
            const maxSupplyE8s = BigInt(poolTokenomics.primary_token_max_supply || "0");
            const initialBurnE8s = BigInt(poolTokenomics.initial_secondary_burn || "0");
            
            if (maxSupplyE8s > tgeE8s && initialBurnE8s > 0n) {
                const availableSupply = maxSupplyE8s - tgeE8s;
                const firstEpochReward = availableSupply / 2n; // First epoch gets 50% of available
                initialRewardPerBurnUnit = (firstEpochReward / initialBurnE8s).toString();
            }
        }

        const result = {
            primaryMaxSupply,
            tgeAllocation,
            initialSecondaryBurn,
            halvingStep,
            initialRewardPerBurnUnit
        };
        
        console.log('TokenomicsTab calculated values:', {
            ...result,
            poolId: poolData?.[0],
            hasSchedule: !!tokenomicsSchedule,
            scheduleLength: tokenomicsSchedule?.primary_mint_per_threshold?.length || 0
        });
        
        return result;
    }, [poolData, tokenomicsSchedule]);

    // Render states
    if (!poolData) {
        return (
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> tokenomics
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">status:</span>
                    <span className="terminal-accent">no_active_pool_selected</span>
                </div>
            </div>
        );
    }


    if (!tokenomicsValues) {
        return (
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> tokenomics
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">status:</span>
                    <span className="terminal-accent">no_data_available</span>
                </div>
                {swap.tokenomicsScheduleError && (
                    <div className="terminal-row">
                        <span className="terminal-label">error:</span>
                        <span className="terminal-error">{swap.tokenomicsScheduleError}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="terminal-pure mb-4">
                <div className="terminal-header mb-2">
                    <span className="terminal-prompt">&gt;&gt;</span> tokenomics_visualization
                </div>
                <div className="terminal-row">
                    <span className="terminal-label">status:</span>
                    <span className="terminal-primary">[LOADED]</span>
                </div>
            </div>
            
            <Suspense fallback={<UnifiedSkeleton variant="card" rows={5} />}>
                <UnifiedTokenomicsGraphs
                    key={poolData?.[0] || 'default'} // Force re-render when pool changes
                    primaryMaxSupply={tokenomicsValues.primaryMaxSupply}
                    tgeAllocation={tokenomicsValues.tgeAllocation}
                    initialSecondaryBurn={tokenomicsValues.initialSecondaryBurn}
                    halvingStep={tokenomicsValues.halvingStep}
                    initialRewardPerBurnUnit={tokenomicsValues.initialRewardPerBurnUnit}
                    deployedSchedule={tokenomicsSchedule}
                    currentState={tokenomicsCurrentState}
                />
            </Suspense>
        </div>
    );
};

export default TokenomicsTab;