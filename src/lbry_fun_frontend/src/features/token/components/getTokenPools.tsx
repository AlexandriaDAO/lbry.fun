import React, { useEffect, useState } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getTokenPools from "../thunk/getTokenPools.thunk";
import { Button } from "@/lib/components/button";
import { useNavigate } from "react-router-dom";
import { lbryFunFlagHandler } from '@/features/token/lbryFunSlice'; // If you need to reset flags
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/lib/components/card";
import { HttpAgent, Actor } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory as icrc1IdlFactory } from "../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did.js";
import type { Value as Icrc1Value } from "../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did.d.ts";

// Token Logo Component that reuses existing logo fetching logic
const TokenLogo: React.FC<{
  tokenId: string;
  tokenSymbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ tokenId, tokenSymbol, size = 'md', className = '' }) => {
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  useEffect(() => {
    const fetchLogo = async () => {
      if (!tokenId || loading) return;
      
      setLoading(true);
      try {
        const network = process.env.DFX_NETWORK || process.env.REACT_APP_DFX_NETWORK;
        const localReplicaHost = network === 'local' ? 'http://localhost:4943' : 'https://ic0.app';

        const agent = new HttpAgent({ host: localReplicaHost });

        await agent.fetchRootKey().catch(err => {
          console.warn("Unable to fetch root key. Swallowing error.", err);
        });

        const tokenActor = Actor.createActor(icrc1IdlFactory, {
          agent,
          canisterId: Principal.fromText(tokenId),
        });

        const metadata = await tokenActor.icrc1_metadata() as Array<[string, Icrc1Value]>;
        
        let logoEntry = metadata.find(item => item[0] === "logo");
        if (!logoEntry) {
          logoEntry = metadata.find(item => item[0] === "icrc1:logo");
        }

        if (logoEntry && logoEntry[1] && ('Text' in logoEntry[1])) {
          let svgData = logoEntry[1].Text;
          const duplicatedPrefix = "data:image/svg+xml;base64,data:image/svg+xml;base64,";
          if (svgData.startsWith(duplicatedPrefix)) {
            svgData = "data:image/svg+xml;base64," + svgData.substring(duplicatedPrefix.length);
          }
          setLogo(svgData);
        } else {
          setLogo(undefined);
        }
      } catch (error) {
        console.error(`Failed to fetch logo for ${tokenId}:`, error);
        setLogo(undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();
  }, [tokenId, loading]);

  if (logo) {
    return (
      <img 
        src={logo} 
        alt={`${tokenSymbol} logo`} 
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      />
    );
  }

  // Fallback when no logo is available
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center border-2 border-border ${className}`}>
      <span className={`font-bold text-white ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-xs'}`}>
        {tokenSymbol.charAt(0)}
      </span>
    </div>
  );
};

const GetTokenPools = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tokenPools, loading, error, success } = useAppSelector((state) => state.lbryFun);

  useEffect(() => {
    // Fetch if pools are not loaded, not currently loading, and there was no previous persistent error
    // This condition prevents re-fetching if already loaded or if an error state needs manual reset.
    if (tokenPools.length === 0 && !loading && !error) {
      dispatch(getTokenPools());
    }
    // Or, if you want to re-fetch if 'success' was reset by lbryFunFlagHandler:
    // if (!success && !loading && !error) {
    //    dispatch(getTokenPools());
    // }
  }, [dispatch, tokenPools.length, loading, error, success]);

  if (loading) return <p className="text-gray-500">Loading token pools...</p>;

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-6 text-foreground">All Tokens</h2>
      {tokenPools?.length === 0 ? (
        <p className="text-gray-500">No tokens found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tokenPools?.map(([id, record]) => (
            <Card key={id} className="group hover:shadow-xl transition-all duration-300 hover:scale-[1.03] bg-gradient-to-br from-card to-card/80 border-2 hover:border-primary/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="pb-4 relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
                    Token #{id}
                  </CardTitle>
                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                    record.isLive 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25' 
                      : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/25'
                  }`}>
                    {record.isLive ? '🟢 Live' : '🔶 Upcoming'}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-5 relative z-10">
                <div className="space-y-4">
                  <div className="flex items-center space-x-4 p-3 bg-gradient-to-r from-primary/5 to-transparent rounded-lg border border-primary/10">
                    <div className="flex-shrink-0">
                      <TokenLogo 
                        tokenId={record.primary_token_id}
                        tokenSymbol={record.primary_token_symbol}
                        size="lg"
                        className="border-3 border-primary/20 shadow-lg"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-foreground truncate mb-1">
                        {record.primary_token_name}
                      </h3>
                      <p className="text-sm font-semibold text-primary">
                        ${record.primary_token_symbol}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between space-x-3 text-sm bg-muted/30 p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground font-medium">Secondary:</span>
                      <TokenLogo 
                        tokenId={record.secondary_token_id}
                        tokenSymbol={record.secondary_token_symbol}
                        size="sm"
                        className="border border-border"
                      />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="font-semibold text-foreground truncate">{record.secondary_token_name}</p>
                      <p className="text-xs text-muted-foreground">${record.secondary_token_symbol}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted-foreground/80">
                    <span>Created {new Date(Number(record.created_time) / 1000000).toLocaleDateString()}</span>
                    {record.liquidity_provided_at && (
                      <span className="flex items-center gap-1">
                        💧 <span>Liquidity Added</span>
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex gap-3 pt-6 relative z-10">
                <Button 
                  variant="primary" 
                  scale="sm" 
                  className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
                  onClick={() => navigate("/swap?id=" + id)}
                >
                  🔄 Trade
                </Button>
                <Button 
                  variant="outline" 
                  scale="sm" 
                  className="flex-1 border-2 hover:bg-secondary/10 hover:border-secondary/50 transition-all duration-200 font-semibold"
                >
                  📊 Kong Swap
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default GetTokenPools;
