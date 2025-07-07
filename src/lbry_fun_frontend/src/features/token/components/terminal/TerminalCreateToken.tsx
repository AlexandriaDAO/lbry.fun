import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import { RootState } from "@/store";
import createToken from '../../thunk/createToken.thunk';
import { lbryFunFlagHandler } from '../../lbryFunSlice';
import { setActiveTokenView } from '@/store/slices/uiSlice';
import { TokenConversionService } from '@/utils/TokenConversionService';
import UnifiedTokenomicsGraphsV2 from '../UnifiedTokenomicsGraphsV2';
import UserICPBalance from '../userICPBalance';
import TooltipIcon from '../TooltipIcon';

import {
  TerminalInput,
  TerminalTextarea,
  TerminalSelect,
  TerminalRange,
  TerminalFileInput,
  TerminalStatus
} from './TerminalFormInputs';

export interface TokenFormValues {
  primary_token_symbol: string;
  primary_token_name: string;
  primary_token_description: string;
  primary_token_logo_base64: string;
  secondary_token_symbol: string;
  secondary_token_name: string;
  secondary_token_description: string;
  secondary_token_logo_base64: string;
  primary_max_supply: string;
  tge_allocation: string;
  initial_secondary_burn: string;
  halving_step: string;
  initial_reward_per_burn_unit: string;
  distribution_interval_seconds: string;
  launch_delay_seconds: string;
}

interface FormErrors {
  [key: string]: string;
}

const TerminalCreateToken: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const lbryFun = useAppSelector((state: RootState) => state.lbryFun);
  const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);

  const [errors, setErrors] = useState<FormErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [halvingStepWarning, setHalvingStepWarning] = useState<string>('');
  const [status, setStatus] = useState<{
    type: 'loading' | 'success' | 'error' | 'idle';
    message?: string;
  }>({ type: 'idle' });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state with LBRY/ALEX reference parameters
  const [form, setForm] = useState<TokenFormValues>({
    primary_token_symbol: '',
    primary_token_name: '',
    primary_token_description: '',
    secondary_token_symbol: '',
    secondary_token_name: '',
    secondary_token_description: '',
    secondary_token_logo_base64: '',
    primary_max_supply: '21000000',
    tge_allocation: '0',
    initial_secondary_burn: '1000000',
    primary_token_logo_base64: '',
    halving_step: '50',
    initial_reward_per_burn_unit: '0.105',
    distribution_interval_seconds: '3600',
    launch_delay_seconds: '86400',
  });

  // Validation logic
  useEffect(() => {
    const newErrors: FormErrors = {};

    // Set informational warnings
    const step = parseInt(form.halving_step, 10);
    if (step >= 25 && step < 40) {
      setHalvingStepWarning("A low value creates an extreme front-load. The number of tokens minted will drop sharply after the first epoch.");
    } else if (step > 75 && step <= 99) {
      setHalvingStepWarning("A high value causes the number of tokens minted per epoch to increase over time. This leads to higher inflation in later stages.");
    } else {
      setHalvingStepWarning('');
    }

    // Validation for disabling form submission
    const requiredFields: Array<keyof TokenFormValues> = [
      'primary_token_symbol', 'primary_token_name', 'primary_token_description', 'primary_token_logo_base64',
      'secondary_token_symbol', 'secondary_token_name', 'secondary_token_description', 'secondary_token_logo_base64',
      'initial_secondary_burn', 'halving_step'
    ];
    requiredFields.forEach(field => {
      if (!form[field]) {
        newErrors[field] = 'This field is required';
      }
    });

    if (form.primary_token_symbol && !/^[A-Z]{3,5}$/.test(form.primary_token_symbol)) {
      newErrors.primary_token_symbol = 'Ticker must be 3-5 uppercase letters';
    }
    if (form.secondary_token_symbol && !/^[A-Z]{3,5}$/.test(form.secondary_token_symbol)) {
      newErrors.secondary_token_symbol = 'Ticker must be 3-5 uppercase letters';
    }
    
    const numericFields: Array<keyof TokenFormValues> = [
      'initial_secondary_burn', 'primary_max_supply', 'initial_reward_per_burn_unit'
    ];
    numericFields.forEach(field => {
      if (form[field] && isNaN(Number(form[field]))) {
        newErrors[field] = 'Must be a valid number';
      }
    });

    // Validate hard cap minimum
    const hardCap = parseInt(form.primary_max_supply);
    if (!newErrors.primary_max_supply && hardCap > 0 && hardCap < 1000000) {
      newErrors.primary_max_supply = 'Hard cap must be at least 1,000,000 tokens (prevents dust issues)';
    }

    const initialBurn = parseFloat(form.initial_secondary_burn);
    const secondaryTokenPrice = 0.005;
    if (!newErrors.initial_secondary_burn && initialBurn > 0 && (initialBurn * secondaryTokenPrice) < 5000) {
      newErrors.initial_secondary_burn = `Initial valuation must be at least $5,000 to prevent bot attacks. Current: $${(initialBurn * secondaryTokenPrice).toLocaleString()}`;
    }

    // Calculate theoretical first epoch
    const remainingSupply = hardCap - parseInt(form.tge_allocation || '1');
    const initialReward = parseInt(form.initial_reward_per_burn_unit);
    const initialBurnAmount = parseInt(form.initial_secondary_burn);
    
    if (!newErrors.initial_reward_per_burn_unit && remainingSupply > 0 && initialReward > 0) {
      const firstEpochMint = initialReward * initialBurnAmount;
      const firstEpochPercent = (firstEpochMint / remainingSupply) * 100;
      
      if (firstEpochPercent > 30) {
        newErrors.initial_reward_per_burn_unit = 
          `First epoch would capture ${firstEpochPercent.toFixed(1)}% of supply - reduce initial reward to max 30% for fair distribution`;
      }
      
      if (firstEpochPercent > 90) {
        newErrors.initial_reward_per_burn_unit = 
          `CRITICAL: These parameters would attempt to mint ${firstEpochPercent.toFixed(1)}% in first epoch alone! Max supply would be exceeded.`;
      }
    }

    if (!newErrors.halving_step && (step < 25 || step > 99)) {
      newErrors.halving_step = `Halving Step must be between 25% and 99%.`;
    }

    // Validate launch delay
    const launchDelay = parseInt(form.launch_delay_seconds);
    if (!form.launch_delay_seconds || isNaN(launchDelay)) {
      newErrors.launch_delay_seconds = 'Launch delay is required';
    } else if (launchDelay < 1) {
      newErrors.launch_delay_seconds = 'Launch delay must be at least 1 second';
    } else if (launchDelay > 2592000) { // 30 days in seconds
      newErrors.launch_delay_seconds = 'Launch delay cannot exceed 30 days';
    }

    setErrors(newErrors);
  }, [form]);

  const handleFieldTouch = (field: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
  };

  const updateForm = (field: keyof TokenFormValues, value: string) => {
    const integerFieldNames: Array<keyof TokenFormValues> = [
      'primary_max_supply',
      'initial_secondary_burn',
      'halving_step'
    ];
    
    if (field === 'tge_allocation') return;

    if (integerFieldNames.includes(field)) {
      if (value === '' || /^[0-9]+$/.test(value)) {
        setForm(prev => ({ ...prev, [field]: value }));
      }
    } else if (field === 'initial_reward_per_burn_unit') {
      // Allow decimals for initial reward
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setForm(prev => ({ ...prev, [field]: value }));
      }
    } else {
      setForm(prev => ({ ...prev, [field]: value }));
    }
    
    // Mark field as touched when user types
    handleFieldTouch(field);
  };

  // Helper to determine if an error should be shown
  const shouldShowError = (field: string): boolean => {
    return submitAttempted && !!errors[field];
  };

  // Helper to format large numbers in human-readable format
  const formatSupplyDisplay = (value: string): string => {
    const num = parseFloat(value) || 0;
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(1)}B`;
    } else if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) {
      console.log('Submission already in progress, ignoring duplicate attempt');
      return;
    }
    
    setSubmitAttempted(true);
    
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    setIsSubmitting(true);
    setStatus({ type: 'loading', message: 'Creating tokens...' });
    
    if (!isAuthenticated || !principal) {
      setStatus({ type: 'error', message: 'Please log in to create a token.' });
      setIsSubmitting(false);
      return;
    }
    
    // Convert whole token values to e8s for the backend
    const formDataForBackend = {
      ...form,
      primary_max_supply: (BigInt(form.primary_max_supply) * BigInt(TokenConversionService.getE8S())).toString(),
      initial_primary_mint: (BigInt(form.tge_allocation) * BigInt(TokenConversionService.getE8S())).toString(),
      initial_secondary_burn: (BigInt(form.initial_secondary_burn) * BigInt(TokenConversionService.getE8S())).toString(),
      initial_reward_per_burn_unit: (BigInt(Math.floor(parseFloat(form.initial_reward_per_burn_unit) * Number(TokenConversionService.getE8S())))).toString(),
      halving_step: form.halving_step,
      distribution_interval_seconds: form.distribution_interval_seconds,
      launch_delay_seconds: form.launch_delay_seconds,
    };

    dispatch(createToken({ formData: formDataForBackend, userPrincipal: principal }));
    console.log('Submitting (converted to e8s):', formDataForBackend);
  };

  useEffect(() => {
    if (lbryFun.success === true) {
      dispatch(lbryFunFlagHandler());
      setStatus({ type: 'success', message: 'Token created successfully!' });
      setIsSubmitting(false);
      setTimeout(() => {
        navigate('/token/success');
      }, 1500);
    } 
    if (lbryFun.error !== null) {
      setStatus({ type: 'error', message: lbryFun.error.message });
      setIsSubmitting(false);
    }
  }, [lbryFun.success, lbryFun.error, dispatch, navigate]);

  const distributionIntervalOptions = [
    { value: '60', label: '1_minute' },
    { value: '300', label: '5_minutes' },
    { value: '900', label: '15_minutes' },
    { value: '1800', label: '30_minutes' },
    { value: '3600', label: '1_hour [default]' },
    { value: '7200', label: '2_hours' },
    { value: '14400', label: '4_hours' },
    { value: '28800', label: '8_hours' },
    { value: '43200', label: '12_hours' },
    { value: '86400', label: '24_hours' },
  ];

  const launchDelayOptions = [
    { value: '1', label: '1_second' },
    { value: '60', label: '1_minute' },
    { value: '300', label: '5_minutes' },
    { value: '900', label: '15_minutes' },
    { value: '1800', label: '30_minutes' },
    { value: '3600', label: '1_hour' },
    { value: '7200', label: '2_hours' },
    { value: '14400', label: '4_hours' },
    { value: '28800', label: '8_hours' },
    { value: '43200', label: '12_hours' },
    { value: '86400', label: '24_hours [default]' },
    { value: '172800', label: '2_days' },
    { value: '259200', label: '3_days' },
    { value: '604800', label: '7_days' },
    { value: '1209600', label: '14_days' },
    { value: '2592000', label: '30_days' },
  ];

  return (
    <div className="terminal-form">
      {/* Header */}
      <div className="terminal-header">
        <span className="terminal-prompt">&gt;&gt;</span> create_new_token
        <span className="terminal-status float-right">[FORM MODE]</span>
      </div>

      {/* How it works */}
      <details className="terminal-section">
        <summary className="terminal-command cursor-pointer">
          <span className="terminal-prompt">&gt;</span> how_it_works
        </summary>
        <div className="p-4 text-xs space-y-2">
          <div>
            <span className="terminal-label">secondary_tokens:</span>
            <div className="pl-4">
              - mint at fixed rate: $0.01 in ICP
              - burn to create primary tokens + recover 50% ICP
            </div>
          </div>
          <div>
            <span className="terminal-label">primary_tokens:</span>
            <div className="pl-4">
              - no fixed price; created by burning secondary
              - minting difficulty increases each epoch
            </div>
          </div>
          <div>
            <span className="terminal-label">icp_revenue_flow:</span>
            <div className="pl-4">
              - every interval, 1% of ICP pool distributed:
              - 1% to LBRY buyback
              - 49.5% to primary staking rewards
              - 49.5% to primary buybacks + locked liquidity
            </div>
          </div>
        </div>
      </details>

      <UserICPBalance />

      <form onSubmit={handleSubmit}>
        {/* Primary and Secondary Token Sections */}
        <div className="terminal-split">
          {/* Primary Token */}
          <div className="terminal-section">
            <div className="terminal-section-header">
              <span className="terminal-prompt">&gt;</span> primary_token_config
            </div>
            
            <TerminalInput
              label="name"
              value={form.primary_token_name}
              onChange={(v) => updateForm('primary_token_name', v)}
              onBlur={() => handleFieldTouch('primary_token_name')}
              error={shouldShowError('primary_token_name') ? errors.primary_token_name : undefined}
              placeholder="Enter token name"
              required
            />
            
            <TerminalInput
              label="symbol"
              value={form.primary_token_symbol}
              onChange={(v) => updateForm('primary_token_symbol', v)}
              onBlur={() => handleFieldTouch('primary_token_symbol')}
              error={shouldShowError('primary_token_symbol') ? errors.primary_token_symbol : undefined}
              placeholder="3-5 uppercase letters"
              required
            />
            
            <TerminalTextarea
              label="description"
              value={form.primary_token_description}
              onChange={(v) => updateForm('primary_token_description', v)}
              onBlur={() => handleFieldTouch('primary_token_description')}
              error={shouldShowError('primary_token_description') ? errors.primary_token_description : undefined}
              placeholder="Describe your token"
              rows={4}
              required
            />
            
            <TerminalFileInput
              label="logo_image (.svg)"
              value={form.primary_token_logo_base64}
              onChange={(base64) => updateForm('primary_token_logo_base64', base64)}
              error={shouldShowError('primary_token_logo_base64') ? errors.primary_token_logo_base64 : undefined}
              required
            />
          </div>

          {/* Secondary Token */}
          <div className="terminal-section">
            <div className="terminal-section-header">
              <span className="terminal-prompt">&gt;</span> secondary_token_config
            </div>
            
            <TerminalInput
              label="name"
              value={form.secondary_token_name}
              onChange={(v) => updateForm('secondary_token_name', v)}
              error={shouldShowError('secondary_token_name') ? errors.secondary_token_name : undefined}
              placeholder="Enter token name"
              required
            />
            
            <TerminalInput
              label="symbol"
              value={form.secondary_token_symbol}
              onChange={(v) => updateForm('secondary_token_symbol', v)}
              error={shouldShowError('secondary_token_symbol') ? errors.secondary_token_symbol : undefined}
              placeholder="3-5 uppercase letters"
              required
            />
            
            <TerminalTextarea
              label="description"
              value={form.secondary_token_description}
              onChange={(v) => updateForm('secondary_token_description', v)}
              error={shouldShowError('secondary_token_description') ? errors.secondary_token_description : undefined}
              placeholder="Describe your token"
              rows={4}
              required
            />
            
            <TerminalFileInput
              label="logo_image (.svg)"
              value={form.secondary_token_logo_base64}
              onChange={(base64) => updateForm('secondary_token_logo_base64', base64)}
              error={shouldShowError('secondary_token_logo_base64') ? errors.secondary_token_logo_base64 : undefined}
              required
            />
          </div>
        </div>

        {/* Token Parameters */}
        <div className="terminal-section">
          <div className="terminal-section-header">
            <span className="terminal-prompt">&gt;</span> token_parameters
          </div>

          <div className="terminal-grid">
            {/* Hard Cap */}
            <div>
              <div className="flex items-center mb-1">
                <span className="terminal-label">hard_cap</span>
                <span className="terminal-error ml-1">*</span>
                <TooltipIcon 
                  text="The absolute maximum number of Primary Tokens that can ever exist. This includes initial minting and all tokens from the burning schedule."
                />
              </div>
              <TerminalInput
                label=""
                value={form.primary_max_supply}
                onChange={(v) => updateForm('primary_max_supply', v)}
                error={shouldShowError('primary_max_supply') ? errors.primary_max_supply : undefined}
                placeholder="e.g. 10000000"
              />
              <TerminalRange
                label=""
                value={form.primary_max_supply}
                onChange={(v) => updateForm('primary_max_supply', v)}
                min={1000000}
                max={100000000000}
                step={1000000}
              />
              <div className="terminal-helper text-xs mt-1 text-gray-500">
                = {formatSupplyDisplay(form.primary_max_supply)} tokens
              </div>
            </div>

            {/* Initial Reward per Burn Unit */}
            <div>
              <div className="flex items-center mb-1">
                <span className="terminal-label">initial_reward_per_burn_unit</span>
                <span className="terminal-error ml-1">*</span>
                <TooltipIcon
                  text="The number of Primary Tokens that will be minted when the 'Burn Unit' is met for the first time. This sets the starting rate for the entire minting schedule."
                />
              </div>
              <TerminalInput
                label=""
                value={form.initial_reward_per_burn_unit}
                onChange={(v) => updateForm('initial_reward_per_burn_unit', v)}
                error={shouldShowError('initial_reward_per_burn_unit') ? errors.initial_reward_per_burn_unit : undefined}
                placeholder="e.g. 0.105"
              />
              <TerminalRange
                label=""
                value={form.initial_reward_per_burn_unit}
                onChange={(v) => updateForm('initial_reward_per_burn_unit', v)}
                min={0.001}
                max={20}
                step={0.001}
                helperText={form.primary_max_supply && form.initial_secondary_burn ? 
                  `First epoch will mint: ${(parseFloat(form.initial_reward_per_burn_unit || '0') * parseInt(form.initial_secondary_burn || '0')).toLocaleString()} tokens (${((parseFloat(form.initial_reward_per_burn_unit || '0') * parseInt(form.initial_secondary_burn || '0') / parseInt(form.primary_max_supply)) * 100).toFixed(2)}% of supply)` 
                  : 'Set supply and burn unit first'}
              />
            </div>

            {/* Burn Unit */}
            <div>
              <div className="flex items-center mb-1">
                <span className="terminal-label">burn_unit</span>
                <span className="terminal-error ml-1">*</span>
                <TooltipIcon 
                  text="The amount of Secondary Tokens that need to be burned to complete the FIRST epoch of the Primary Token minting schedule. Subsequent epochs will require more burns."
                />
              </div>
              <TerminalInput
                label=""
                value={form.initial_secondary_burn}
                onChange={(v) => updateForm('initial_secondary_burn', v)}
                error={shouldShowError('initial_secondary_burn') ? errors.initial_secondary_burn : undefined}
                placeholder="e.g. 1000000 tokens"
              />
              <TerminalRange
                label=""
                value={form.initial_secondary_burn}
                onChange={(v) => updateForm('initial_secondary_burn', v)}
                min={1000000}
                max={100000000}
                step={100000}
                helperText={form.initial_secondary_burn ? `initial_valuation: $${(parseInt(form.initial_secondary_burn) * 0.005).toLocaleString()} USD` : ''}
              />
              {form.initial_secondary_burn && parseInt(form.initial_secondary_burn) * 0.005 < 5000 && (
                <div className="terminal-warning">[WARN] Initial valuation below $5,000 threshold - vulnerable to bot attacks</div>
              )}
            </div>

            {/* Halving Step */}
            <div>
              <div className="flex items-center mb-1">
                <span className="terminal-label">halving_step (%)</span>
                <span className="terminal-error ml-1">*</span>
                <TooltipIcon
                  text="The percentage by which the minting reward is multiplied each epoch. A value < 50% causes tokens minted per epoch to decrease (front-loaded). A value > 50% causes tokens minted per epoch to increase (back-loaded)."
                />
              </div>
              <TerminalInput
                label=""
                value={form.halving_step}
                onChange={(v) => updateForm('halving_step', v)}
                error={shouldShowError('halving_step') ? errors.halving_step : undefined}
                placeholder="e.g. 50"
              />
              <TerminalRange
                label=""
                value={form.halving_step}
                onChange={(v) => updateForm('halving_step', v)}
                min={25}
                max={99}
                step={1}
                suffix="%"
                warning={halvingStepWarning}
              />
            </div>
          </div>

          {/* Distribution Interval - Advanced */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-gray-600 text-xs font-mono hover:text-gray-400 transition-colors flex items-center"
            >
              <span className="mr-2">{showAdvanced ? '▼' : '▶'}</span>
              <span className="terminal-label">advanced_settings</span>
            </button>
            
            {showAdvanced && (
              <div className="terminal-advanced mt-3">
                <div className="flex items-center mb-1">
                  <span className="terminal-label">distribution_interval</span>
                  <TooltipIcon
                    text="Controls how often rewards are distributed. Every interval, exactly 1% of the total ICP pool is split: 1% to LBRY buyback, 49.5% to stakers, and 49.5% to liquidity. DEFAULT: 1 hour. WARNING: Only change if you understand the implications."
                  />
                </div>
                <TerminalSelect
                  label=""
                  value={form.distribution_interval_seconds}
                  onChange={(v) => updateForm('distribution_interval_seconds', v)}
                  options={distributionIntervalOptions}
                />
                <div className="terminal-helper mt-1">[WARN] Advanced setting - Default (1 hour) recommended. Cannot be changed after creation.</div>
                
                <div className="flex items-center mb-1 mt-4">
                  <span className="terminal-label">launch_delay</span>
                  <TooltipIcon
                    text="Time delay before trading opens after token creation. During this period, only the creator can view token details. DEFAULT: 24 hours. Min: 1 second, Max: 30 days."
                  />
                </div>
                <TerminalSelect
                  label=""
                  value={form.launch_delay_seconds}
                  onChange={(v) => updateForm('launch_delay_seconds', v)}
                  options={launchDelayOptions}
                />
                <div className="terminal-helper mt-1">[INFO] Trading will be enabled after this delay. Default (24 hours) prevents bot sniping.</div>
              </div>
            )}
          </div>
        </div>

        {/* Parameter Validation Warnings */}
        {(form.initial_reward_per_burn_unit && form.primary_max_supply && 
          parseInt(form.initial_reward_per_burn_unit) > (parseInt(form.primary_max_supply) - parseInt(form.tge_allocation || '1')) * 0.1) && (
          <div className="terminal-warning">
            [WARN] High reward exceeds 10% of remaining supply - enables unfair launches where bots can monopolize early epochs. Reduce initial reward to ensure at least 3 meaningful distribution epochs.
          </div>
        )}

        {/* Tokenomics Preview */}
        <div className="terminal-section">
          <div className="terminal-section-header">
            <span className="terminal-prompt">&gt;</span> tokenomics_preview
          </div>
          <UnifiedTokenomicsGraphsV2
            primaryMaxSupply={form.primary_max_supply}
            tgeAllocation={form.tge_allocation}
            initialSecondaryBurn={form.initial_secondary_burn}
            halvingStep={form.halving_step}
            initialRewardPerBurnUnit={form.initial_reward_per_burn_unit}
          />
        </div>

        {/* Submit Commands */}
        <div className="terminal-commands">
          <button
            type="submit"
            className="terminal-command"
            disabled={Object.keys(errors).length > 0 || status.type === 'loading' || isSubmitting}
          >
            &gt; execute_token_creation
          </button>
          <button
            type="button"
            className="terminal-command"
            onClick={() => dispatch(setActiveTokenView('TokenPools'))}
          >
            &gt; cancel
          </button>
        </div>
      </form>

      {/* Status bar */}
      <TerminalStatus status={status} />
    </div>
  );
};

export default TerminalCreateToken;