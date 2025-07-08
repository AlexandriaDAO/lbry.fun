import React, { useState } from 'react';
import { Principal } from '@dfinity/principal';
import { getTokenomicsActor, getActorSwap } from '@/features/auth/utils/authUtils';
import { Button } from '@/lib/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/lib/components/dialog';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartBar, faPlay, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from '@/store';

interface CanisterStatsProps {
  canisterId: string;
  canisterName: string;
  canisterType: 'tokenomics' | 'icp_swap';
}

interface QueryFunction {
  name: string;
  label: string;
  description: string;
  requiresAuth?: boolean;
}

interface QueryResult {
  functionName: string;
  value: any;
  loading: boolean;
  error?: string;
}

const TOKENOMICS_FUNCTIONS: QueryFunction[] = [
  {
    name: 'get_tokenomics_schedule',
    label: 'Tokenomics Schedule',
    description: 'Returns the complete threshold and reward arrays'
  },
  {
    name: 'get_current_threshold_index',
    label: 'Current Threshold Index',
    description: 'Returns which threshold level we\'re currently at'
  },
  {
    name: 'get_current_primary_rate',
    label: 'Current Primary Rate',
    description: 'Returns the current reward rate from the rewards array'
  },
  {
    name: 'get_current_secondary_threshold',
    label: 'Current Secondary Threshold',
    description: 'Returns the current threshold value'
  },
  {
    name: 'get_max_stats',
    label: 'Max Stats',
    description: 'Returns the last threshold and total burned'
  },
  {
    name: 'get_total_secondary_burn',
    label: 'Total Secondary Burned',
    description: 'Returns the cumulative amount of secondary tokens burned'
  },
  {
    name: 'fetch_total_minted_primary',
    label: 'Primary Token Supply',
    description: 'Returns the current total supply of primary tokens'
  },
  {
    name: 'get_configs',
    label: 'System Configuration',
    description: 'Returns configuration including token canister IDs and max supply cap'
  }
];

const ICP_SWAP_FUNCTIONS: QueryFunction[] = [
  {
    name: 'get_current_secondary_ratio',
    label: 'Current Mint Rate',
    description: 'How many secondary tokens you get per 1 ICP'
  },
  {
    name: 'get_current_staking_reward_percentage',
    label: 'Staking APR Base',
    description: 'The percentage of the ICP pool distributed hourly to stakers'
  },
  {
    name: 'get_tokenomics_schedule',
    label: 'Halving Schedule',
    description: 'Shows all burn thresholds and corresponding primary token rewards'
  },
  {
    name: 'get_current_threshold_index',
    label: 'Current Halving Level',
    description: 'Which halving tier we\'re currently on (0 = first tier)'
  },
  {
    name: 'get_current_primary_rate',
    label: 'Current Mining Rate',
    description: 'How many primary tokens you get per secondary token burned'
  },
  {
    name: 'get_current_secondary_threshold',
    label: 'Next Halving At',
    description: 'How many secondary tokens need to be burned to reach next halving'
  },
  {
    name: 'get_total_secondary_burn',
    label: 'Total Burned',
    description: 'Total secondary tokens burned so far'
  },
  {
    name: 'get_all_stakes',
    label: 'All Stakers',
    description: 'Complete list of all stakers and their positions'
  },
  {
    name: 'get_stakers_count',
    label: 'Total Stakers',
    description: 'Number of unique addresses staking'
  },
  {
    name: 'get_total_unclaimed_icp_reward',
    label: 'Pending Rewards Pool',
    description: 'Total ICP rewards waiting to be claimed'
  },
  {
    name: 'get_all_apy_values',
    label: 'Historical APY',
    description: 'Past APY values over time to analyze reward trends'
  },
  {
    name: 'fetch_total_minted_primary',
    label: 'Primary Token Supply',
    description: 'Current circulating supply of primary tokens'
  },
  {
    name: 'get_max_stats',
    label: 'Max Supply Info',
    description: 'Maximum burn threshold and progress towards it'
  },
  {
    name: 'get_distribution_interval',
    label: 'Reward Frequency',
    description: 'How often rewards are distributed (in seconds)'
  }
];

export const CanisterStats: React.FC<CanisterStatsProps> = ({
  canisterId,
  canisterName,
  canisterType
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Record<string, QueryResult>>({});
  const { principal } = useAppSelector((state: RootState) => state.auth);

  const functions = canisterType === 'tokenomics' ? TOKENOMICS_FUNCTIONS : ICP_SWAP_FUNCTIONS;

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'YES' : 'NO';
    if (typeof value === 'bigint') return value.toLocaleString();
    if (typeof value === 'number') return value.toLocaleString();
    if (Array.isArray(value)) {
      if (value.length === 0) return 'Empty array';
      if (value.length > 10) return `[${value.length} items]`;
      return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
    }
    return String(value);
  };

  const queryFunction = async (func: QueryFunction) => {
    // Check if auth is required
    if (func.requiresAuth && !principal) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Set loading state
    setResults(prev => ({
      ...prev,
      [func.name]: { functionName: func.name, value: null, loading: true }
    }));

    try {
      let result;
      
      if (canisterType === 'tokenomics') {
        const actor = await getTokenomicsActor(canisterId);
        
        switch (func.name) {
          case 'get_tokenomics_schedule':
            result = await actor.get_tokenomics_schedule();
            break;
          case 'get_current_threshold_index':
            result = await actor.get_current_threshold_index();
            break;
          case 'get_current_primary_rate':
            result = await actor.get_current_primary_rate();
            break;
          case 'get_current_secondary_threshold':
            result = await actor.get_current_secondary_threshold();
            break;
          case 'get_max_stats':
            result = await actor.get_max_stats();
            break;
          case 'get_total_secondary_burn':
            result = await actor.get_total_secondary_burn();
            break;
          case 'fetch_total_minted_primary':
            result = await actor.fetch_total_minted_primary();
            break;
          case 'get_configs':
            result = await actor.get_configs();
            break;
          default:
            throw new Error(`Unknown function: ${func.name}`);
        }
      } else {
        const actor = await getActorSwap(canisterId);
        
        switch (func.name) {
          case 'get_current_secondary_ratio':
            result = await actor.get_current_secondary_ratio();
            break;
          case 'get_current_staking_reward_percentage':
            result = await actor.get_current_staking_reward_percentage();
            break;
          case 'get_tokenomics_schedule':
            result = await actor.get_tokenomics_schedule();
            break;
          case 'get_current_threshold_index':
            result = await actor.get_current_threshold_index();
            break;
          case 'get_current_primary_rate':
            result = await actor.get_current_primary_rate();
            break;
          case 'get_current_secondary_threshold':
            result = await actor.get_current_secondary_threshold();
            break;
          case 'get_total_secondary_burn':
            result = await actor.get_total_secondary_burn();
            break;
          case 'get_all_stakes':
            result = await actor.get_all_stakes();
            break;
          case 'get_stakers_count':
            result = await actor.get_stakers_count();
            break;
          case 'get_total_unclaimed_icp_reward':
            result = await actor.get_total_unclaimed_icp_reward();
            break;
          case 'get_all_apy_values':
            result = await actor.get_all_apy_values();
            break;
          case 'fetch_total_minted_primary':
            result = await actor.fetch_total_minted_primary();
            break;
          case 'get_max_stats':
            result = await actor.get_max_stats();
            break;
          case 'get_distribution_interval':
            result = await actor.get_distribution_interval();
            break;
          default:
            throw new Error(`Unknown function: ${func.name}`);
        }
      }

      setResults(prev => ({
        ...prev,
        [func.name]: { functionName: func.name, value: result, loading: false }
      }));
    } catch (error) {
      console.error(`Error querying ${func.name}:`, error);
      setResults(prev => ({
        ...prev,
        [func.name]: { 
          functionName: func.name, 
          value: null, 
          loading: false, 
          error: error.message || 'Query failed' 
        }
      }));
    }
  };

  return (
    <>
      <Button
        variant="outline"
        scale="sm"
        onClick={() => setIsOpen(true)}
        className="terminal-button"
      >
        <FontAwesomeIcon icon={faChartBar} className="mr-2" />
        Get Stats
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="terminal-pure max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="terminal-header">
              <span className="terminal-prompt">&gt;</span> {canisterName} QUERY FUNCTIONS
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto terminal-section">
            <div className="space-y-3">
              {functions.map((func) => {
                const result = results[func.name];
                const isLoading = result?.loading;
                const hasResult = result && !result.loading && result.value !== null;
                
                return (
                  <div key={func.name} className="terminal-info p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lime-500 font-bold">{func.label}</span>
                          {func.requiresAuth && !principal && (
                            <span className="text-xs text-yellow-500">[requires auth]</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mb-2">
                          {func.description}
                        </div>
                        <div className="font-mono text-xs text-cyan-400">
                          {func.name}()
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        scale="sm"
                        onClick={() => queryFunction(func)}
                        disabled={isLoading || (func.requiresAuth && !principal)}
                        className="terminal-button ml-4"
                      >
                        <FontAwesomeIcon 
                          icon={isLoading ? faSpinner : faPlay} 
                          className={isLoading ? 'animate-spin' : ''}
                        />
                      </Button>
                    </div>
                    
                    {hasResult && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-xs text-gray-400 mb-1">Result:</div>
                        <pre className="text-xs text-white overflow-x-auto whitespace-pre-wrap break-words">
                          {formatValue(result.value)}
                        </pre>
                      </div>
                    )}
                    
                    {result?.error && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="text-xs text-red-500">
                          Error: {result.error}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};