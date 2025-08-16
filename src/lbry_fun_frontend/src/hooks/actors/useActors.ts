import { useContext } from 'react';
import { IcpLedgerContext, IcpSwapContext, TokenomicsContext, LbryFunContext } from '@/contexts/actors';

// Hook to use IcpLedger actor
export const useIcpLedgerActor = () => {
    const context = useContext(IcpLedgerContext);
    if (!context || !context.actor) {
        throw new Error('useIcpLedgerActor must be used within IcpLedgerActor provider');
    }
    return context.actor;
};

// Hook to use IcpSwap actor
export const useIcpSwapActor = () => {
    const context = useContext(IcpSwapContext);
    if (!context || !context.actor) {
        throw new Error('useIcpSwapActor must be used within IcpSwapActor provider');
    }
    return context.actor;
};

// Hook to use Tokenomics actor
export const useTokenomicsActor = () => {
    const context = useContext(TokenomicsContext);
    if (!context || !context.actor) {
        throw new Error('useTokenomicsActor must be used within TokenomicsActor provider');
    }
    return context.actor;
};

// Hook to use LbryFun actor
export const useLbryFunActor = () => {
    const context = useContext(LbryFunContext);
    if (!context || !context.actor) {
        throw new Error('useLbryFunActor must be used within LbryFunActor provider');
    }
    return context.actor;
};