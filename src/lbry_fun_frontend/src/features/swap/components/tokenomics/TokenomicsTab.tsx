import React, { useEffect, useMemo } from 'react';
import UnifiedTokenomicsGraphs from '@/features/token/components/UnifiedTokenomicsGraphs';
import { LoaderCircle } from 'lucide-react';
import { useUnifiedSwapData } from '../../providers/UnifiedSwapDataProvider';

const TokenomicsTab: React.FC = () => {
    const { poolData, tokenomics, loadTokenomics, isLoading, errors } = useUnifiedSwapData();

    useEffect(() => {
        loadTokenomics();
    }, [loadTokenomics]);

    // Calculate tokenomics values using useMemo to avoid recalculation and ensure hooks are always called
    const tokenomicsValues = useMemo(() => {
        if (!tokenomics) {
            return null;
        }

        const E8S = 100_000_000n;
        
        // Get values from poolData's tokenomics info
        const poolTokenomics = poolData?.[1];
        if (!poolTokenomics) {
            return null;
        }

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
    }, [tokenomics, poolData]);

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

    if (isLoading.tokenomics) {
        return (
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> loading_tokenomics
                </div>
                <div className="flex justify-center items-center h-32">
                    <LoaderCircle size={20} className="animate animate-spin text-white" />
                </div>
            </div>
        );
    }

    if (errors.tokenomics) {
        return (
            <div className="terminal-pure">
                <div className="terminal-header">
                    <span className="terminal-prompt">&gt;&gt;</span> tokenomics_error
                </div>
                <div className="terminal-row">
                    <span className="terminal-status">[ERROR]</span>
                    <span className="terminal-accent">{errors.tokenomics}</span>
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
            
            <UnifiedTokenomicsGraphs
                primaryMaxSupply={tokenomicsValues.primaryMaxSupply}
                tgeAllocation={tokenomicsValues.tgeAllocation}
                initialSecondaryBurn={tokenomicsValues.initialSecondaryBurn}
                halvingStep={tokenomicsValues.halvingStep}
                initialRewardPerBurnUnit={tokenomicsValues.initialRewardPerBurnUnit}
                deployedSchedule={poolData?.[1]}
            />
        </div>
    );
};

export default TokenomicsTab;