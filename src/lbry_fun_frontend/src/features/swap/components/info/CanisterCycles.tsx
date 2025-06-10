import React, { useEffect, useState } from 'react';
import { Principal } from '@dfinity/principal';
import { getLbryFunActor } from '@/features/auth/utils/authUtils';
import { toast } from 'sonner';

interface CanisterCyclesProps {
    canisterId: string;
}

const CanisterCycles: React.FC<CanisterCyclesProps> = ({ canisterId }) => {
    const [cycles, setCycles] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
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
    }, [canisterId]);

    return (
        <div className="flex justify-between items-center text-sm pl-4">
            <span className="font-semibold text-gray-400">Cycles Balance:</span>
            <span className="text-white">
                {loading && "Loading..."}
                {error && <span className="text-red-400">Error</span>}
                {cycles !== null && !loading && !error && `${cycles} T`}
            </span>
        </div>
    );
};

export default CanisterCycles; 