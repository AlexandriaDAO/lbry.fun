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
import { initiateTokenDeployment, fetchDeploymentHistory } from '../../thunk/deploymentThunks';
import { CreateTokenParams } from '@/types/deployment';
import { DeploymentStatusModal } from '../DeploymentStatusModal';
import { setActiveDeploymentId } from '@/store/slices/deploymentSlice';

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
  threshold_multiplier: string;
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
  const { activeDeploymentId } = useAppSelector((state: RootState) => state.deployment);

  const [errors, setErrors] = useState<FormErrors>({});
  const [warnings, setWarnings] = useState<FormErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [status, setStatus] = useState<{
    type: 'loading' | 'success' | 'error' | 'idle';
    message?: string;
  }>({ type: 'idle' });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);

  // Form state with LBRY/ALEX reference parameters
  const [form, setForm] = useState<TokenFormValues>({
    primary_token_symbol: '',
    primary_token_name: '',
    primary_token_description: '',
    secondary_token_symbol: '',
    secondary_token_name: '',
    secondary_token_description: '',
    secondary_token_logo_base64: '',
    primary_max_supply: '1000000000',
    tge_allocation: '0',
    initial_secondary_burn: '1000000',
    primary_token_logo_base64: '',
    halving_step: '90',
    threshold_multiplier: '1.5',
    initial_reward_per_burn_unit: '1',
    distribution_interval_seconds: '3600',
    launch_delay_seconds: '86400',
  });

  // Validation logic
  useEffect(() => {
    const newErrors: FormErrors = {};
    const newWarnings: FormErrors = {};


    // Validation for disabling form submission
    const requiredFields: Array<keyof TokenFormValues> = [
      'primary_token_symbol', 'primary_token_name', 'primary_token_description', 'primary_token_logo_base64',
      'secondary_token_symbol', 'secondary_token_name', 'secondary_token_description', 'secondary_token_logo_base64',
      'initial_secondary_burn', 'halving_step', 'threshold_multiplier'
    ];
    requiredFields.forEach(field => {
      if (!form[field]) {
        newErrors[field] = 'This field is required';
      }
    });

    // Symbol validation (2-10 characters, letters and numbers allowed per ICRC1)
    if (form.primary_token_symbol) {
      if (form.primary_token_symbol.length < 2 || form.primary_token_symbol.length > 10) {
        newErrors.primary_token_symbol = 'Symbol must be 2-10 characters';
      } else if (!/^[A-Za-z0-9]+$/.test(form.primary_token_symbol)) {
        newErrors.primary_token_symbol = 'Symbol must contain only letters and numbers';
      } else if (/[a-z]/.test(form.primary_token_symbol)) {
        // Warning for lowercase - not a blocking error but important to note
        newWarnings.primary_token_symbol = '⚠️ Contains lowercase letters - unconventional! Standard is uppercase (e.g., BTC, ETH). This is permanent.';
      }
    }
    if (form.secondary_token_symbol) {
      if (form.secondary_token_symbol.length < 2 || form.secondary_token_symbol.length > 10) {
        newErrors.secondary_token_symbol = 'Symbol must be 2-10 characters';
      } else if (!/^[A-Za-z0-9]+$/.test(form.secondary_token_symbol)) {
        newErrors.secondary_token_symbol = 'Symbol must contain only letters and numbers';
      } else if (/[a-z]/.test(form.secondary_token_symbol)) {
        // Warning for lowercase - not a blocking error but important to note
        newWarnings.secondary_token_symbol = '⚠️ Contains lowercase letters - unconventional! Standard is uppercase (e.g., BTC, ETH). This is permanent.';
      }
    }
    
    // Name validation (max 100 characters)
    if (form.primary_token_name && form.primary_token_name.length > 100) {
      newErrors.primary_token_name = `Name too long (${form.primary_token_name.length}/100 characters)`;
    }
    if (form.secondary_token_name && form.secondary_token_name.length > 100) {
      newErrors.secondary_token_name = `Name too long (${form.secondary_token_name.length}/100 characters)`;
    }
    
    // Description validation (max 500 characters)
    if (form.primary_token_description && form.primary_token_description.length > 500) {
      newErrors.primary_token_description = `Description too long (${form.primary_token_description.length}/500 characters)`;
    }
    if (form.secondary_token_description && form.secondary_token_description.length > 500) {
      newErrors.secondary_token_description = `Description too long (${form.secondary_token_description.length}/500 characters)`;
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



    
    // Validate threshold multiplier
    const multiplier = parseFloat(form.threshold_multiplier);
    if (!form.threshold_multiplier) {
      newErrors.threshold_multiplier = 'Threshold multiplier is required';
    } else if (isNaN(multiplier)) {
      newErrors.threshold_multiplier = 'Must be a valid number';
    } else if (multiplier < 1 || multiplier > 10) {
      newErrors.threshold_multiplier = 'Must be between 1 and 10';
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
    setWarnings(newWarnings);
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
    
    const decimalFieldNames: Array<keyof TokenFormValues> = [
      'initial_reward_per_burn_unit',
      'threshold_multiplier'
    ];
    
    const symbolFields: Array<keyof TokenFormValues> = [
      'primary_token_symbol',
      'secondary_token_symbol'
    ];
    
    if (field === 'tge_allocation') return;

    if (integerFieldNames.includes(field)) {
      if (value === '' || /^[0-9]+$/.test(value)) {
        setForm(prev => ({ ...prev, [field]: value }));
      }
    } else if (decimalFieldNames.includes(field)) {
      // Allow decimals for these fields
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setForm(prev => ({ ...prev, [field]: value }));
      }
    } else if (symbolFields.includes(field)) {
      // For symbol fields: only allow letters and numbers per ICRC1 standard
      if (value === '' || /^[A-Za-z0-9]*$/.test(value)) {
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
  
  // Helper to determine if a warning should be shown
  const shouldShowWarning = (field: string): boolean => {
    return touchedFields.has(field) && !!warnings[field];
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setSubmitAttempted(true);
    if (Object.keys(errors).length > 0) return;
    
    setIsSubmitting(true);
    setStatus({ type: 'loading', message: 'Initiating deployment...' });
    
    if (!isAuthenticated || !principal) {
      setStatus({ type: 'error', message: 'Please log in to create a token.' });
      setIsSubmitting(false);
      return;
    }
    
    // Convert form data to deployment params
    const params: CreateTokenParams = {
      primary_token_name: form.primary_token_name,
      primary_token_symbol: form.primary_token_symbol,
      primary_token_description: form.primary_token_description,
      primary_logo: form.primary_token_logo_base64,
      secondary_token_name: form.secondary_token_name,
      secondary_token_symbol: form.secondary_token_symbol,
      secondary_token_description: form.secondary_token_description,
      secondary_logo: form.secondary_token_logo_base64,
      primary_max_supply: BigInt(form.primary_max_supply) * BigInt(TokenConversionService.getE8S()),
      initial_primary_mint: BigInt(form.tge_allocation) * BigInt(TokenConversionService.getE8S()),
      initial_secondary_burn: BigInt(form.initial_secondary_burn) * BigInt(TokenConversionService.getE8S()),
      halving_step: BigInt(form.halving_step),
      threshold_multiplier: parseFloat(form.threshold_multiplier),
      initial_reward_per_burn_unit: BigInt(Math.floor(parseFloat(form.initial_reward_per_burn_unit) * Number(TokenConversionService.getE8S()))),
      distribution_interval_seconds: BigInt(form.distribution_interval_seconds),
      launch_delay_seconds: BigInt(form.launch_delay_seconds)
    };
    
    // Phase 1: Initiate deployment
    const result = await dispatch(initiateTokenDeployment(params));
    
    if (initiateTokenDeployment.fulfilled.match(result)) {
      // Successfully initiated, open modal to execute phase 2
      setShowDeploymentModal(true);
      setIsSubmitting(false);
    } else {
      // Initiation failed
      setStatus({ 
        type: 'error', 
        message: result.payload?.message || 'Failed to initiate deployment' 
      });
      setIsSubmitting(false);
    }
  };

  // Show deployment modal when activeDeploymentId is set (from deployments page)
  useEffect(() => {
    if (activeDeploymentId) {
      setShowDeploymentModal(true);
    }
  }, [activeDeploymentId]);

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
    <div className="bg-black border border-white/30 font-mono text-sm p-4">
      {/* Header */}
      <div className="font-mono font-bold text-white mb-1 text-sm uppercase">
        <span className="text-pink-500">&gt;&gt;</span> create_new_token
        <span className="text-gray-400 text-xs float-right">[FORM MODE]</span>
      </div>

      {/* How it works */}
      <details className="font-mono text-sm mb-4">
        <summary className="text-white font-mono text-sm py-2 hover:text-pink-500 cursor-pointer transition-colors">
          <span className="text-pink-500">&gt;</span> how_it_works
        </summary>
        <div className="pl-4 pt-2 text-xs space-y-2">
          <div>
            <span className="text-gray-400 text-xs">secondary_tokens:</span>
            <div className="pl-4">
              - mint at fixed rate: $0.01 in ICP
              - burn to create primary tokens + recover 50% ICP
            </div>
          </div>
          <div>
            <span className="text-gray-400 text-xs">primary_tokens:</span>
            <div className="pl-4">
              - no fixed price; created by burning secondary
              - minting difficulty increases each epoch
            </div>
          </div>
          <div>
            <span className="text-gray-400 text-xs">icp_revenue_flow:</span>
            <div className="pl-4">
              - every interval, 1% of ICP pool distributed:
              - 1% to ALEX stakers wallet
              - 99% to locked kongswap liquidity
            </div>
          </div>
        </div>
      </details>

      <UserICPBalance />

      <form onSubmit={handleSubmit}>
        {/* Primary and Secondary Token Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Primary Token */}
          <div className="font-mono text-sm">
            <div className="font-mono font-bold text-white mb-3 text-sm uppercase">
              <span className="text-pink-500">&gt;</span> primary_token_config
            </div>
            
            <TerminalInput
              label="name"
              value={form.primary_token_name}
              onChange={(v) => updateForm('primary_token_name', v)}
              onBlur={() => handleFieldTouch('primary_token_name')}
              error={shouldShowError('primary_token_name') ? errors.primary_token_name : undefined}
              placeholder="Enter token name"
              maxLength={100}
              helperText={form.primary_token_name ? `${form.primary_token_name.length}/100 characters` : undefined}
              required
            />
            
            <TerminalInput
              label="symbol"
              value={form.primary_token_symbol}
              onChange={(v) => updateForm('primary_token_symbol', v)}
              onBlur={() => handleFieldTouch('primary_token_symbol')}
              error={shouldShowError('primary_token_symbol') ? errors.primary_token_symbol : 
                     shouldShowWarning('primary_token_symbol') ? warnings.primary_token_symbol : undefined}
              placeholder="e.g., BTC, USDT, ckETH"
              maxLength={10}
              helperText={form.primary_token_symbol ? `${form.primary_token_symbol.length}/10 characters` : '2-10 characters'}
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
              maxLength={500}
              helperText={form.primary_token_description ? `${form.primary_token_description.length}/500 characters` : undefined}
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
          <div className="font-mono text-sm">
            <div className="font-mono font-bold text-white mb-3 text-sm uppercase">
              <span className="text-pink-500">&gt;</span> secondary_token_config
            </div>
            
            <TerminalInput
              label="name"
              value={form.secondary_token_name}
              onChange={(v) => updateForm('secondary_token_name', v)}
              onBlur={() => handleFieldTouch('secondary_token_name')}
              error={shouldShowError('secondary_token_name') ? errors.secondary_token_name : undefined}
              placeholder="Enter token name"
              maxLength={100}
              helperText={form.secondary_token_name ? `${form.secondary_token_name.length}/100 characters` : undefined}
              required
            />
            
            <TerminalInput
              label="symbol"
              value={form.secondary_token_symbol}
              onChange={(v) => updateForm('secondary_token_symbol', v)}
              onBlur={() => handleFieldTouch('secondary_token_symbol')}
              error={shouldShowError('secondary_token_symbol') ? errors.secondary_token_symbol : 
                     shouldShowWarning('secondary_token_symbol') ? warnings.secondary_token_symbol : undefined}
              placeholder="e.g., xBTC, mUSDT"
              maxLength={10}
              helperText={form.secondary_token_symbol ? `${form.secondary_token_symbol.length}/10 characters` : '2-10 characters'}
              required
            />
            
            <TerminalTextarea
              label="description"
              value={form.secondary_token_description}
              onChange={(v) => updateForm('secondary_token_description', v)}
              onBlur={() => handleFieldTouch('secondary_token_description')}
              error={shouldShowError('secondary_token_description') ? errors.secondary_token_description : undefined}
              placeholder="Describe your token"
              rows={4}
              maxLength={500}
              helperText={form.secondary_token_description ? `${form.secondary_token_description.length}/500 characters` : undefined}
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

        {/* Divider */}
        <div className="border-t border-white/10 my-6"></div>

        {/* Token Parameters */}
        <div className="font-mono text-sm">
          <div className="font-mono font-bold text-white mb-3 text-sm uppercase">
            <span className="text-pink-500">&gt;</span> token_parameters
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hard Cap */}
            <div>
              <div className="flex items-center mb-1">
                <span className="text-gray-400 text-xs">hard_cap</span>
                <span className="text-red-400 ml-1">*</span>
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
              <div className="text-gray-600 text-xs mt-1 font-mono text-xs mt-1 text-gray-500">
                = {formatSupplyDisplay(form.primary_max_supply)} tokens
              </div>
            </div>

            {/* Initial Reward per Burn Unit */}
            <div>
              <div className="flex items-center mb-1">
                <span className="text-gray-400 text-xs">initial_reward_per_burn_unit</span>
                <span className="text-red-400 ml-1">*</span>
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
                min={0.01}
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
                <span className="text-gray-400 text-xs">burn_unit</span>
                <span className="text-red-400 ml-1">*</span>
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
            </div>

            {/* Halving Step */}
            <div>
              <div className="flex items-center mb-1">
                <span className="text-gray-400 text-xs">halving_step (%)</span>
                <span className="text-red-400 ml-1">*</span>
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
              />
            </div>

            {/* Threshold Multiplier */}
            <div>
              <div className="flex items-center mb-1">
                <span className="text-gray-400 text-xs">threshold_multiplier (x)</span>
                <span className="text-red-400 ml-1">*</span>
                <TooltipIcon
                  text="The multiplier for burn threshold progression between epochs. 2x means each epoch requires double the burns of the previous. Higher values create faster progression, lower values create slower progression."
                />
              </div>
              <TerminalInput
                label=""
                value={form.threshold_multiplier}
                onChange={(v) => updateForm('threshold_multiplier', v)}
                error={shouldShowError('threshold_multiplier') ? errors.threshold_multiplier : undefined}
                placeholder="e.g. 2"
              />
              <TerminalRange
                label=""
                value={form.threshold_multiplier}
                onChange={(v) => updateForm('threshold_multiplier', v)}
                min={1}
                max={10}
                step={0.1}
                suffix="x"
                helperText={`Each epoch will require ${form.threshold_multiplier}x the burns of the previous epoch`}
              />
            </div>
          </div>

          {/* Distribution Interval - Advanced */}
          <div className="mt-6 font-mono">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-left text-xs text-gray-400 hover:text-white transition-colors border-t border-white/10 pt-4"
            >
              <span>
                <span className="text-pink-500">&gt;</span> advanced_settings
              </span>
              <span className="ml-2">{showAdvanced ? '[-]' : '[+]'}</span>
            </button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center mb-1">
                  <span className="text-gray-400 text-xs">distribution_interval</span>
                  <TooltipIcon
                    text="Controls how often rewards are distributed. Every interval, exactly 1% of the total ICP pool is split: 1% to ALEX stakers wallet, 99% to locked kongswap liquidity. DEFAULT: 1 hour. WARNING: Only change if you understand the implications."
                  />
                </div>
                <TerminalSelect
                  label=""
                  value={form.distribution_interval_seconds}
                  onChange={(v) => updateForm('distribution_interval_seconds', v)}
                  options={distributionIntervalOptions}
                />
                <div className="text-gray-600 text-xs mt-1 font-mono mt-1">Cannot be changed after creation.</div>
                
                <div className="flex items-center mb-1 mt-4">
                  <span className="text-gray-400 text-xs">launch_delay</span>
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
                <div className="text-gray-600 text-xs mt-1 font-mono mt-1">[INFO] Trading will be enabled after this delay. Default (24 hours) prevents bot sniping.</div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-6"></div>

        {/* Tokenomics Preview */}
        <div className="font-mono text-sm">
          <UnifiedTokenomicsGraphsV2
            primaryMaxSupply={form.primary_max_supply}
            tgeAllocation={form.tge_allocation}
            initialSecondaryBurn={form.initial_secondary_burn}
            halvingStep={form.halving_step}
            initialRewardPerBurnUnit={form.initial_reward_per_burn_unit}
            thresholdMultiplier={form.threshold_multiplier}
          />
        </div>


        {/* Cost transparency display */}
        <div className="bg-blue-900/20 border border-blue-500/30 text-blue-400 p-3 font-mono text-sm mb-4">
          <div className="text-gray-400 text-xs">Deployment Cost:</div>
          <div className="text-sm">
            <span>Total: 5.0 ICP</span>
            <span className="ml-4 text-xs text-gray-400">
              (Refundable on failure: 4.0 ICP)
            </span>
          </div>
        </div>

        {/* Submit Commands */}
        <div className="flex gap-4">
          <button
            type="submit"
            className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10"
            disabled={Object.keys(errors).length > 0 || status.type === 'loading' || isSubmitting}
          >
            &gt; execute_token_creation
          </button>
          <button
            type="button"
            className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10"
            onClick={() => navigate('/deployments')}
          >
            &gt; view_deployment_history
          </button>
          <button
            type="button"
            className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-2 hover:bg-white/10"
            onClick={() => dispatch(setActiveTokenView('TokenPools'))}
          >
            &gt; cancel
          </button>
        </div>
      </form>

      {/* Status bar */}
      <TerminalStatus status={status} />
      
      {/* Deployment Status Modal */}
      <DeploymentStatusModal 
        deploymentId={activeDeploymentId}
        isOpen={showDeploymentModal}
        onClose={() => {
          setShowDeploymentModal(false);
          // Clear the deployment ID from Redux
          dispatch(setActiveDeploymentId(null));
        }}
        onSuccess={(tokenId) => {
          navigate(`/swap?id=${tokenId}`);
        }}
      />
    </div>
  );
};

export default TerminalCreateToken;