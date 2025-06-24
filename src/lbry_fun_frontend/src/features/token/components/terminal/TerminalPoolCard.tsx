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

  const formatTvl = (tvlValue: string): string => {
    const formatted = TokenConversionService.formatE8sDisplay(BigInt(tvlValue), 0);
    return formatted.replace(/,/g, '');
  };

  const truncateId = (id: string): string => {
    if (id.length <= 10) return id;
    return `${id.slice(0, 5)}...${id.slice(-3)}`;
  };

  return (
    <div className="terminal-card">
      <div className="terminal-card-header">
        <div>
          <span className="terminal-prompt">&gt;</span>
          <span className="terminal-pool-id ml-1">#{truncateId(poolId)}</span>
        </div>
        <span className="terminal-status">
          {pool.isLive ? '[LIVE]' : '[PENDING]'}
        </span>
      </div>
      
      <div className="terminal-card-content">
        {/* Primary Token */}
        <div className="terminal-token-display">
          <TokenLogo 
            tokenId={pool.primary_token_id}
            tokenSymbol={pool.primary_token_symbol}
          />
          <div className="terminal-token-info">
            <div className="terminal-value truncate">{pool.primary_token_name}</div>
            <div className="terminal-primary">${pool.primary_token_symbol}</div>
          </div>
        </div>

        {/* Secondary Token */}
        <div className="terminal-row">
          <span className="terminal-label">secondary:</span>
          <div className="flex items-center space-x-2">
            <TokenLogo 
              tokenId={pool.secondary_token_id}
              tokenSymbol={pool.secondary_token_symbol}
              className="w-6 h-6"
            />
            <span className="terminal-accent">${pool.secondary_token_symbol}</span>
          </div>
        </div>

        {/* TVL */}
        <div className="terminal-row">
          <span className="terminal-label">tvl:</span>
          <span className="terminal-primary">
            {tvlLoading ? '...' : tvl ? `$${formatTvl(tvl.tvl)}` : '$0'}
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
          className="terminal-action flex-1 text-center" 
          onClick={() => navigate(`/swap?id=${poolId}`)}
        >
          &gt; trade
        </button>
        <button className="terminal-action flex-1 text-center">
          &gt; kong
        </button>
      </div>
    </div>
  );
};

export default TerminalPoolCard;