import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TokenConversionService } from '@/utils/TokenConversionService';
import { HttpAgent, Actor } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory as icrc1IdlFactory } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did.js";
import type { Value as Icrc1Value } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did.d.ts";

interface PoolRecord {
  primary_token_id: string;
  primary_token_name: string;
  primary_token_symbol: string;
  secondary_token_id: string;
  secondary_token_name: string;
  secondary_token_symbol: string;
  created_time: bigint;
  isLive: boolean;
}

interface TerminalPoolCardProps {
  pool: PoolRecord;
  poolId: string;
  tvl?: { tvl: string };
  tvlLoading?: boolean;
}

// Token metadata hook
const useTokenMetadata = (tokenId: string) => {
  const [metadata, setMetadata] = useState<{ description?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
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

        const metadataArray = await tokenActor.icrc1_metadata() as Array<[string, Icrc1Value]>;
        
        // Look for description in metadata
        const descEntry = metadataArray.find(([key]) => 
          key === 'description' || key === 'icrc1:description'
        );
        
        if (descEntry && descEntry[1] && 'Text' in descEntry[1]) {
          setMetadata({ description: descEntry[1].Text });
        }
      } catch (error) {
        console.error(`Failed to fetch metadata for ${tokenId}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [tokenId, loading]);

  return metadata;
};

// Token Logo Component - Terminal Style
const TokenLogo: React.FC<{
  tokenId: string;
  tokenSymbol: string;
  className?: string;
}> = ({ tokenId, tokenSymbol, className = '' }) => {
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

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
        className={`terminal-token-image ${className}`}
        style={{ borderRadius: 0 }}
      />
    );
  }

  // Fallback when no logo is available
  return (
    <div className={`terminal-token-image flex items-center justify-center bg-black ${className}`}>
      <span className="text-white font-mono text-sm">
        {tokenSymbol.charAt(0)}
      </span>
    </div>
  );
};

const TerminalPoolCard: React.FC<TerminalPoolCardProps> = ({ pool, poolId, tvl, tvlLoading }) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  
  // Fetch metadata for both tokens
  const primaryMetadata = useTokenMetadata(pool.primary_token_id);
  const secondaryMetadata = useTokenMetadata(pool.secondary_token_id);

  useEffect(() => {
    // Add a small delay for staggered boot-up effect
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, Math.random() * 300);
    
    return () => clearTimeout(timer);
  }, []);

  const formatTvl = (tvlValue: string): string => {
    const formatted = TokenConversionService.formatE8sDisplay(BigInt(tvlValue), 0);
    return formatted.replace(/,/g, '');
  };

  const truncateId = (id: string): string => {
    if (id.length <= 10) return id;
    return `${id.slice(0, 5)}...${id.slice(-3)}`;
  };

  return (
    <div className={`terminal-card ${isVisible ? 'terminal-boot' : 'opacity-0'}`}>
      <div className="terminal-card-header">
        <div>
          <span className="terminal-prompt">&gt;</span>
          <span className="terminal-pool-id ml-1">#{truncateId(poolId)}</span>
        </div>
        <span className={pool.isLive ? 'terminal-status-live' : 'terminal-status'}>
          {pool.isLive ? '[LIVE]' : '[PENDING]'}
        </span>
      </div>
      
      <div className="terminal-card-content">
        {/* Token Pair Display */}
        <div className="space-y-3">
          {/* Primary Token - Larger text */}
          <div className="flex items-start gap-2">
            <TokenLogo 
              tokenId={pool.primary_token_id}
              tokenSymbol={pool.primary_token_symbol}
              className="w-12 h-12 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="terminal-value text-base truncate">{pool.primary_token_name}</div>
              <div className="terminal-primary text-sm">${pool.primary_token_symbol}</div>
              {primaryMetadata.description && (
                <div className="terminal-label text-xs opacity-60 truncate mt-1">
                  {primaryMetadata.description}
                </div>
              )}
            </div>
          </div>
          
          {/* Visual Separator */}
          <div className="flex items-center gap-2">
            <div className="h-px bg-white/10 flex-1"></div>
            <span className="text-gray-600 text-xs">/</span>
            <div className="h-px bg-white/10 flex-1"></div>
          </div>
          
          {/* Secondary Token - Smaller text */}
          <div className="flex items-start gap-2">
            <TokenLogo 
              tokenId={pool.secondary_token_id}
              tokenSymbol={pool.secondary_token_symbol}
              className="w-8 h-8 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="terminal-value text-xs truncate">{pool.secondary_token_name}</div>
              <div className="terminal-accent text-xs">${pool.secondary_token_symbol}</div>
              {secondaryMetadata.description && (
                <div className="terminal-label text-xs opacity-50 truncate mt-0.5">
                  {secondaryMetadata.description}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TVL */}
        <div className="terminal-row">
          <span className="terminal-label">tvl:</span>
          <span className="terminal-primary">
            {tvlLoading ? <span className="terminal-blink">...</span> : tvl ? `$${formatTvl(tvl.tvl)}` : '$0'}
          </span>
        </div>

        {/* Created Date */}
        <div className="terminal-row">
          <span className="terminal-label">created:</span>
          <span className="terminal-accent">
            {new Date(Number(pool.created_time) / 1000000).toLocaleDateString()}
          </span>
        </div>
      </div>
      
      <div className="terminal-card-footer">
        <button 
          className="terminal-action flex-1 text-center group" 
          onClick={() => navigate(`/swap?id=${poolId}`)}
        >
          <span className="group-hover:hidden">&gt; trade</span>
          <span className="hidden group-hover:inline">&gt; trade<span className="terminal-blink"></span></span>
        </button>
        <button className="terminal-action flex-1 text-center group">
          <span className="group-hover:hidden">&gt; kong</span>
          <span className="hidden group-hover:inline">&gt; kong<span className="terminal-blink"></span></span>
        </button>
      </div>
    </div>
  );
};

export default TerminalPoolCard;