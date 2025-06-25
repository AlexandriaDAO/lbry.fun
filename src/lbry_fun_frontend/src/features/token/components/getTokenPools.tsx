import React, { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getTokenPools from "../thunk/getTokenPools.thunk";
import getPoolsTvl from "../thunk/getPoolsTvl.thunk";
import getIcpPrice from "@/features/icp-ledger/thunks/getIcpPrice";
import { setActiveTokenView } from '@/store/slices/uiSlice';
import TerminalPoolCard from './terminal/TerminalPoolCard';


const GetTokenPools = () => {
  const dispatch = useAppDispatch();
  const { tokenPools, loading, error, success, tvlData, tvlLoading } = useAppSelector((state) => state.lbryFun);
  const { icpPrice, icpPriceTimestamp } = useAppSelector((state) => state.icpLedger);

  // Fetch ICP price if not available or stale (older than 5 minutes)
  useEffect(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (!icpPrice || !icpPriceTimestamp || icpPriceTimestamp < fiveMinutesAgo) {
      dispatch(getIcpPrice());
    }
  }, [dispatch, icpPrice, icpPriceTimestamp]);

  useEffect(() => {
    if (tokenPools.length === 0 && !loading && !error) {
      dispatch(getTokenPools());
    }
  }, [dispatch, tokenPools.length, loading, error, success]);

  // Fetch TVL data when token pools are loaded and ICP price is available
  useEffect(() => {
    if (tokenPools.length > 0 && !tvlLoading && Object.keys(tvlData).length === 0 && icpPrice) {
      dispatch(getPoolsTvl(tokenPools));
    }
  }, [dispatch, tokenPools, tvlLoading, tvlData, icpPrice]);

  if (loading) return <p className="text-gray-500 font-mono text-sm">loading pools...</p>;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6 terminal-boot">
        <div className="flex items-center space-x-2">
          <span className="terminal-prompt text-2xl">&gt;</span>
          <span className="terminal-header text-2xl">active_pools</span>
          <span className="terminal-status text-lg terminal-typewriter">[{tokenPools?.length || 0} TOKENS]</span>
        </div>
        <button 
          className="terminal-create-button group"
          onClick={() => dispatch(setActiveTokenView('CreateToken'))}
        >
          <span className="group-hover:hidden">&gt; create_token</span>
          <span className="hidden group-hover:inline">&gt; create_token<span className="terminal-blink"></span></span>
        </button>
      </div>
      
      {tokenPools?.length === 0 ? (
        <p className="terminal-label terminal-blink">no tokens found.</p>
      ) : (
        <>
          <div className="terminal-divider-dots mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative">
            {/* Subtle grid lines overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-5">
              <div className="h-full w-full" style={{
                backgroundImage: `
                  repeating-linear-gradient(0deg, transparent, transparent 200px, #84cc16 200px, #84cc16 201px),
                  repeating-linear-gradient(90deg, transparent, transparent 200px, #84cc16 200px, #84cc16 201px)
                `,
                backgroundSize: '100% 100%'
              }} />
            </div>
            {tokenPools?.map(([id, record], index) => (
              <TerminalPoolCard 
                key={id} 
                pool={record} 
                poolId={id} 
                tvl={tvlData[id]}
                tvlLoading={tvlLoading}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GetTokenPools;
