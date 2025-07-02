import React, { useMemo, lazy, Suspense, useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import UnifiedSkeleton from './UnifiedSkeleton';
import previewTokenomicsSchedule, { TokenomicsSchedule } from '@/features/token/thunk/previewTokenomicsSchedule.thunk';

// Lazy load the tokenomics graphs
const UnifiedTokenomicsGraphsV2 = lazy(() => import('@/features/token/components/UnifiedTokenomicsGraphsV2'));

const TokenomicsTab: React.FC = () => {
    const dispatch = useAppDispatch();
    const { swap } = useAppSelector(state => state);
    const poolData = swap.activeSwapPool;
    const tokenomicsCurrentState = swap.tokenomicsCurrentState;
    const [preCalculatedSchedule, setPreCalculatedSchedule] = useState<TokenomicsSchedule | null>(null);
    const [scheduleLoading, setScheduleLoading] = useState(false);

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
        
        // Use the actual initial_reward_per_burn_unit from the pool data
        const initialRewardPerBurnUnit = poolTokenomics.initial_reward_per_burn_unit;

        const result = {
            primaryMaxSupply,
            tgeAllocation,
            initialSecondaryBurn,
            halvingStep,
            initialRewardPerBurnUnit
        };
        
        // Debug logging commented out to avoid potential serialization issues
        // console.log('TokenomicsTab calculated values:', {
        //     ...result,
        //     poolId: poolData?.[0],
        //     hasSchedule: !!tokenomicsSchedule,
        //     scheduleLength: tokenomicsSchedule?.primary_mint_per_threshold?.length || 0
        // });
        
        return result;
    }, [poolData]);

    // Fetch pre-calculated schedule when tokenomics values are available
    useEffect(() => {
        if (tokenomicsValues && !scheduleLoading) {
            setScheduleLoading(true);
            
            const E8S_MULTIPLIER = BigInt(100_000_000);
            
            dispatch(previewTokenomicsSchedule({
                primary_per_threshold: parseInt(tokenomicsValues.initialRewardPerBurnUnit),
                max_primary_supply: BigInt(tokenomicsValues.primaryMaxSupply) * E8S_MULTIPLIER,
                initial_secondary_burn: parseInt(tokenomicsValues.initialSecondaryBurn),
                halving_step: parseInt(tokenomicsValues.halvingStep),
                tge_allocation: BigInt(tokenomicsValues.tgeAllocation) * E8S_MULTIPLIER,
            }))
            .unwrap()
            .then((result) => {
                setPreCalculatedSchedule(result);
                setScheduleLoading(false);
            })
            .catch((error) => {
                console.error("Failed to fetch tokenomics schedule:", error);
                setScheduleLoading(false);
            });
        }
    }, [tokenomicsValues, dispatch]);

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
                <UnifiedTokenomicsGraphsV2
                    key={poolData?.[0] || 'default'} // Force re-render when pool changes
                    primaryMaxSupply={tokenomicsValues.primaryMaxSupply}
                    tgeAllocation={tokenomicsValues.tgeAllocation}
                    initialSecondaryBurn={tokenomicsValues.initialSecondaryBurn}
                    halvingStep={tokenomicsValues.halvingStep}
                    initialRewardPerBurnUnit={tokenomicsValues.initialRewardPerBurnUnit}
                    deployedSchedule={null} // Don't use deployed schedule - calculate everything fresh
                    currentState={tokenomicsCurrentState}
                    preCalculatedSchedule={preCalculatedSchedule}
                />
            </Suspense>
        </div>
    );
};

export default TokenomicsTab;