import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getActorSwap } from '@/features/auth/utils/authUtils';
import TooltipIcon from '@/features/token/components/TooltipIcon';

interface ValidationResult {
  rewardConsistency: { status: 'success' | 'error' | 'loading' | 'idle'; message?: string };
  archiveConsistency: { status: 'success' | 'error' | 'loading' | 'idle'; message?: string };
  accounting: { status: 'success' | 'error' | 'loading' | 'idle'; message?: string };
}

interface ValidationStatusProps {
  tokenId: string;
}

const ValidationStatus: React.FC<ValidationStatusProps> = ({ tokenId }) => {
  const [validationResults, setValidationResults] = useState<ValidationResult>({
    rewardConsistency: { status: 'idle' },
    archiveConsistency: { status: 'idle' },
    accounting: { status: 'idle' }
  });
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidation, setLastValidation] = useState<Date | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const runValidation = async () => {
    setIsValidating(true);
    
    try {
      const actor = await getActorSwap(tokenId);
      
      // Run reward consistency check
      setValidationResults(prev => ({
        ...prev,
        rewardConsistency: { status: 'loading' }
      }));
      
      try {
        const rewardResult = await actor.validate_reward_consistency();
        if ('Ok' in rewardResult) {
          setValidationResults(prev => ({
            ...prev,
            rewardConsistency: { status: 'success', message: rewardResult.Ok }
          }));
        } else {
          setValidationResults(prev => ({
            ...prev,
            rewardConsistency: { status: 'error', message: rewardResult.Err }
          }));
        }
      } catch (err) {
        setValidationResults(prev => ({
          ...prev,
          rewardConsistency: { status: 'error', message: String(err) }
        }));
      }

      // Run archive consistency check
      setValidationResults(prev => ({
        ...prev,
        archiveConsistency: { status: 'loading' }
      }));
      
      try {
        const archiveResult = await actor.validate_archived_consistency();
        if ('Ok' in archiveResult) {
          setValidationResults(prev => ({
            ...prev,
            archiveConsistency: { status: 'success', message: archiveResult.Ok }
          }));
        } else {
          setValidationResults(prev => ({
            ...prev,
            archiveConsistency: { status: 'error', message: archiveResult.Err }
          }));
        }
      } catch (err) {
        setValidationResults(prev => ({
          ...prev,
          archiveConsistency: { status: 'error', message: String(err) }
        }));
      }

      // Run comprehensive accounting validation
      setValidationResults(prev => ({
        ...prev,
        accounting: { status: 'loading' }
      }));
      
      try {
        const accountingResult = await actor.validate_accounting();
        if ('Ok' in accountingResult) {
          setValidationResults(prev => ({
            ...prev,
            accounting: { status: 'success', message: accountingResult.Ok }
          }));
        } else {
          setValidationResults(prev => ({
            ...prev,
            accounting: { status: 'error', message: accountingResult.Err }
          }));
        }
      } catch (err) {
        setValidationResults(prev => ({
          ...prev,
          accounting: { status: 'error', message: String(err) }
        }));
      }

      setLastValidation(new Date());
    } catch (err) {
      console.error('Failed to get actor:', err);
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusIcon = (status: 'success' | 'error' | 'loading' | 'idle') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="text-lime-400" size={16} />;
      case 'error':
        return <XCircle className="text-red-400" size={16} />;
      case 'loading':
        return <RefreshCw className="animate-spin text-gray-400" size={16} />;
      default:
        return <AlertCircle className="text-gray-500" size={16} />;
    }
  };

  const hasErrors = 
    validationResults.rewardConsistency.status === 'error' ||
    validationResults.archiveConsistency.status === 'error' ||
    validationResults.accounting.status === 'error';

  const allIdle = 
    validationResults.rewardConsistency.status === 'idle' &&
    validationResults.archiveConsistency.status === 'idle' &&
    validationResults.accounting.status === 'idle';

  return (
    <div className="border-t border-white/30 mt-2 pt-1">
      <div className="font-mono font-bold text-white mb-1 text-sm uppercase mb-3">
        <span className="text-pink-500">&gt;&gt;</span> ACCOUNTING VALIDATION
      </div>
      
      <div className="space-y-2">
        {/* Summary Status */}
        <div className="flex justify-between items-center py-0.5">
          <span className="text-gray-400 text-xs flex items-center">
            Validation Status:
            <TooltipIcon text="Automated checks that verify internal accounting matches blockchain state. Detects discrepancies, double-spending bugs, and tracking errors." />
          </span>
          <div className="flex items-center gap-2">
            {allIdle ? (
              <span className="text-gray-500 text-sm">Not validated</span>
            ) : hasErrors ? (
              <span className="text-red-400 text-sm">⚠️ Issues Detected</span>
            ) : isValidating ? (
              <span className="text-gray-400 text-sm">Validating...</span>
            ) : (
              <span className="text-lime-400 text-sm">✓ All Checks Pass</span>
            )}
            <button
              onClick={runValidation}
              disabled={isValidating}
              className={`bg-black border border-white/30 text-white font-mono text-xs px-2 py-1 hover:bg-white/10 ${
                isValidating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isValidating ? 'Running...' : 'Validate'}
            </button>
          </div>
        </div>

        {/* Toggle for validation details */}
        {!allIdle && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-500 hover:text-gray-400"
          >
            {showDetails ? '− Hide' : '+ Show'} validation details
          </button>
        )}

        {/* Detailed Results */}
        {showDetails && !allIdle && (
          <>
            <div className="terminal-divider-single my-2" />
            <div className="text-xs space-y-2">
              {/* Reward Consistency */}
              <div className="flex items-start gap-2">
                {getStatusIcon(validationResults.rewardConsistency.status)}
                <div className="flex-1">
                  <div className="text-gray-400">
                    Reward Consistency
                    <TooltipIcon text="Verifies that the sum of all individual staker rewards equals the global reward counter. Mismatches indicate reward tracking bugs." />
                  </div>
                  {validationResults.rewardConsistency.message && (
                    <div className={`mt-1 ${
                      validationResults.rewardConsistency.status === 'error' ? 'text-red-400' : 'text-gray-500'
                    }`}>
                      {validationResults.rewardConsistency.message}
                    </div>
                  )}
                </div>
              </div>

              {/* Archive Consistency */}
              <div className="flex items-start gap-2">
                {getStatusIcon(validationResults.archiveConsistency.status)}
                <div className="flex-1">
                  <div className="text-gray-400">
                    Archive Consistency
                    <TooltipIcon text="Verifies that individual archived balances match the global archived counter. Mismatches could indicate double-spending vulnerabilities." />
                  </div>
                  {validationResults.archiveConsistency.message && (
                    <div className={`mt-1 ${
                      validationResults.archiveConsistency.status === 'error' ? 'text-red-400' : 'text-gray-500'
                    }`}>
                      {validationResults.archiveConsistency.message}
                    </div>
                  )}
                </div>
              </div>

              {/* Comprehensive Accounting */}
              <div className="flex items-start gap-2">
                {getStatusIcon(validationResults.accounting.status)}
                <div className="flex-1">
                  <div className="text-gray-400">
                    Comprehensive Accounting
                    <TooltipIcon text="Full validation including both consistency checks plus balance reconciliation. Compares expected vs actual ICP balance." />
                  </div>
                  {validationResults.accounting.message && (
                    <div className={`mt-1 ${
                      validationResults.accounting.status === 'error' ? 'text-red-400' : 'text-gray-500'
                    } whitespace-pre-wrap`}>
                      {validationResults.accounting.message}
                    </div>
                  )}
                </div>
              </div>

              {lastValidation && (
                <div className="text-gray-600 text-xs mt-2">
                  Last validated: {lastValidation.toLocaleTimeString()}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ValidationStatus;