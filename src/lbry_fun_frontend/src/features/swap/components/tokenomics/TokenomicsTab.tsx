import React, { useEffect, useState, useMemo } from 'react';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import TokenomicsGraphsBackend from '@/features/token/components/TokenomicsGraphsBackend';
import { LoaderCircle } from 'lucide-react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from '../../../../../../declarations/tokenomics';
import { _SERVICE } from '../../../../../../declarations/tokenomics/tokenomics.did';
import { useIdentity } from '@/hooks/useIdentity';
import { Principal } from '@dfinity/principal';

const TokenomicsTab: React.FC = () => {
    const { activeSwapPool } = useAppSelector((state) => state.swap);
    const { identity } = useIdentity();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [configs, setConfigs] = useState<any>(null);
    const [tokenomicsSchedule, setTokenomicsSchedule] = useState<any>(null);
    const [tokenomicsActor, setTokenomicsActor] = useState<_SERVICE | null>(null);

    useEffect(() => {
        if (!activeSwapPool || !activeSwapPool[1]?.tokenomics_canister_id) {
            return;
        }

        const createTokenomicsActor = async () => {
            try {
                const agent = new HttpAgent({
                    identity: identity || undefined,
                    host: process.env.DFX_NETWORK === "ic" ? "https://ic0.app" : "http://localhost:4943"
                });

                // Only fetch root key in local development
                if (process.env.DFX_NETWORK !== "ic") {
                    await agent.fetchRootKey();
                }

                const actor = Actor.createActor<_SERVICE>(idlFactory, {
                    agent,
                    canisterId: Principal.fromText(activeSwapPool[1].tokenomics_canister_id)
                });

                setTokenomicsActor(actor);
            } catch (err) {
                console.error('Failed to create tokenomics actor:', err);
                setError('Failed to connect to tokenomics canister');
            }
        };

        createTokenomicsActor();
    }, [activeSwapPool, identity]);

    useEffect(() => {
        if (!tokenomicsActor) {
            return;
        }

        const fetchTokenomicsData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const [config, schedule] = await Promise.all([
                    tokenomicsActor.get_config(),
                    tokenomicsActor.get_tokenomics_schedule()
                ]);
                setConfigs(config);
                setTokenomicsSchedule(schedule);
            } catch (err) {
                console.error('Failed to fetch tokenomics config:', err);
                setError('Failed to load tokenomics data');
            } finally {
                setLoading(false);
            }
        };

        fetchTokenomicsData();
    }, [tokenomicsActor]);

    // Calculate tokenomics values using useMemo to avoid recalculation and ensure hooks are always called
    const tokenomicsValues = useMemo(() => {
        if (!configs || !tokenomicsSchedule) {
            return null;
        }

        const E8S = 100_000_000n;
        const primaryMaxSupply = (BigInt(configs.max_primary_supply) / E8S).toString();
        const tgeAllocation = (BigInt(configs.initial_primary_mint) / E8S).toString();
        const initialSecondaryBurn = (BigInt(configs.initial_secondary_burn) / E8S).toString();
        const halvingStep = configs.halving_step.toString();
        
        // Calculate initial reward per burn unit
        let initialRewardPerBurnUnit = "1";
        
        if (tokenomicsSchedule.primary_mint_per_threshold && tokenomicsSchedule.primary_mint_per_threshold.length > 0) {
            const firstMintRewardE8s = BigInt(tokenomicsSchedule.primary_mint_per_threshold[0]);
            const initialBurnE8s = BigInt(configs.initial_secondary_burn);
            
            if (firstMintRewardE8s > 0n && initialBurnE8s > 0n) {
                // Convert to float for accurate division
                const firstMintNatural = Number(firstMintRewardE8s) / Number(E8S);
                const initialBurnNatural = Number(initialBurnE8s) / Number(E8S);
                const ratio = firstMintNatural / initialBurnNatural;
                initialRewardPerBurnUnit = ratio.toString();
            }
        }

        return {
            primaryMaxSupply,
            tgeAllocation,
            initialSecondaryBurn,
            halvingStep,
            initialRewardPerBurnUnit
        };
    }, [configs, tokenomicsSchedule]);

    // Render states
    if (!activeSwapPool) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <p className="text-lg font-medium text-foreground">
                    No active token pool selected
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <LoaderCircle size={48} className="animate-spin text-primary" />
                <p className="text-lg font-medium text-foreground">
                    Loading tokenomics data...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <p className="text-lg font-medium text-destructive">
                    {error}
                </p>
            </div>
        );
    }

    if (!tokenomicsValues) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <p className="text-lg font-medium text-foreground">
                    No tokenomics data available
                </p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <TokenomicsGraphsBackend
                primaryMaxSupply={tokenomicsValues.primaryMaxSupply}
                tgeAllocation={tokenomicsValues.tgeAllocation}
                initialSecondaryBurn={tokenomicsValues.initialSecondaryBurn}
                halvingStep={tokenomicsValues.halvingStep}
                initialRewardPerBurnUnit={tokenomicsValues.initialRewardPerBurnUnit}
            />
        </div>
    );
};

export default TokenomicsTab;