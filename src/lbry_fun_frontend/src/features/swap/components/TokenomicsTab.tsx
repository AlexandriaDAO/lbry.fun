import React, { useMemo, lazy, Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import UnifiedSkeleton from './UnifiedSkeleton';

// Lazy load the tokenomics graphs
const UnifiedTokenomicsGraphs = lazy(() => import('@/features/token/components/UnifiedTokenomicsGraphs'));

const TokenomicsTab: React.FC = () => {
    const { swap } = useAppSelector(state => state);
    const poolData = swap.activeSwapPool;

    // Calculate tokenomics values using useMemo to avoid recalculation
    const tokenomicsValues = useMemo(() => {
        const poolTokenomics = poolData?.[1];
        if (!poolTokenomics) {
            return null;
        }

        const E8S = 100_000_000n;
        const primaryMaxSupply = (BigInt(poolTokenomics.primary_max_supply || 0) / E8S).toString();
        const tgeAllocation = (BigInt(poolTokenomics.initial_primary_supply || 0) / E8S).toString();
        const initialSecondaryBurn = (BigInt(poolTokenomics.initial_secondary_burn || 0) / E8S).toString();
        const halvingStep = (poolTokenomics.halving_step || 0).toString();
        
        // Get initial reward per burn unit from the first threshold
        let initialRewardPerBurnUnit = "1";
        if (poolTokenomics.primary_mint_per_threshold && poolTokenomics.primary_mint_per_threshold.length > 0) {
            const firstRewardE8s = BigInt(poolTokenomics.primary_mint_per_threshold[0]);
            initialRewardPerBurnUnit = (firstRewardE8s / E8S).toString();
        }

        return {
            primaryMaxSupply,
            tgeAllocation,
            initialSecondaryBurn,
            halvingStep,
            initialRewardPerBurnUnit
        };
    }, [poolData]);

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
                    primaryMaxSupply={tokenomicsValues.primaryMaxSupply}
                    tgeAllocation={tokenomicsValues.tgeAllocation}
                    initialSecondaryBurn={tokenomicsValues.initialSecondaryBurn}
                    halvingStep={tokenomicsValues.halvingStep}
                    initialRewardPerBurnUnit={tokenomicsValues.initialRewardPerBurnUnit}
                    deployedSchedule={poolData?.[1]}
                />
            </Suspense>
        </div>
    );
};

export default TokenomicsTab;