import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Button } from '@/lib/components/button';
import { Input } from '@/lib/components/input';
import { Textarea } from '@/lib/components/textarea';
import { Label } from '@/lib/components/label';
import { Card } from '@/lib/components/card';
import { Slider } from '@/lib/components/slider';
import createToken from '../thunk/createToken.thunk';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import LoadingModal from '../../swap/components/loadingModal';
import { lbryFunFlagHandler } from '../lbryFunSlice';
import { Form } from 'antd/es';
import UserICPBalance from './userICPBalance';
import SuccessModal from '@/features/swap/components/successModal';
import ErrorModal from '@/features/swap/components/errorModal';
import { useNavigate } from 'react-router-dom';
import { RootState } from "@/store";
import TokenomicsGraphsBackend from './TokenomicsGraphsBackend';
import TooltipIcon from './TooltipIcon';

// Define E8S constant for conversion
const E8S = 100_000_000;

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
  primary_max_phase_mint: string;
  halving_step: string;
  initial_reward_per_burn_unit: string;
}

interface FormErrors {
  [key: string]: string;
}

const CreateTokenForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const lbryFun = useAppSelector((state: RootState) => state.lbryFun);
  const { previewGraphData } = useAppSelector((state: RootState) => state.lbryFun);
  const [loadingModalV, setLoadingModalV] = useState(false);
  const [successModalV, setSucessModalV] = useState(false);    
  const [errorModalV, setErrorModalV] = useState({ flag: false, title: "", message: "" });
  
  const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  const [errors, setErrors] = useState<FormErrors>({});
  const [halvingStepWarning, setHalvingStepWarning] = useState<string>('');

  const [form, setForm] = useState<TokenFormValues>({
    primary_token_symbol: '',
    primary_token_name: '',
    primary_token_description: '',
    secondary_token_symbol: '',
    secondary_token_name: '',
    secondary_token_description: '',
    secondary_token_logo_base64: '',
    primary_max_supply: '1000000',
    tge_allocation: '1',
    initial_secondary_burn: '1000000',
    primary_max_phase_mint: '50000',
    primary_token_logo_base64: '',
    halving_step: '70',
    initial_reward_per_burn_unit: '2000',
  });

  useEffect(() => {
    const newErrors: FormErrors = {};

    // --- Set informational warnings ---
    const step = parseInt(form.halving_step, 10);
    if (step >= 25 && step < 40) {
      setHalvingStepWarning("Warning: A low value creates an extreme front-load. The number of tokens minted will drop sharply after the first epoch.");
    } else if (step > 75 && step <= 99) {
      setHalvingStepWarning("Warning: A high value causes the number of tokens minted per epoch to increase over time. This leads to higher inflation in later stages.");
    } else {
      setHalvingStepWarning('');
    }

    // --- Validation for disabling form submission ---
    const requiredFields: Array<keyof TokenFormValues> = [
      'primary_token_symbol', 'primary_token_name', 'primary_token_description', 'primary_token_logo_base64',
      'secondary_token_symbol', 'secondary_token_name', 'secondary_token_description', 'secondary_token_logo_base64',
      'initial_secondary_burn', 'primary_max_phase_mint', 'halving_step'
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
      'initial_secondary_burn', 'primary_max_phase_mint', 'primary_max_supply', 'initial_reward_per_burn_unit'
    ];
    numericFields.forEach(field => {
      if (form[field] && isNaN(Number(form[field]))) {
        newErrors[field] = 'Must be a valid number';
      }
    });

    // Validate hard cap minimum
    const hardCap = parseInt(form.primary_max_supply);
    if (!newErrors.primary_max_supply && hardCap > 0 && hardCap < 100000) {
      newErrors.primary_max_supply = 'Hard cap must be at least 100,000 tokens (vulnerable to manipulation below this threshold)';
    }

    const initialBurn = parseFloat(form.initial_secondary_burn);
    const secondaryTokenPrice = 0.005;
    if (!newErrors.initial_secondary_burn && initialBurn > 0 && (initialBurn * secondaryTokenPrice) < 1000) {
      newErrors.initial_secondary_burn = `Initial valuation must be at least $1,000 to prevent bot attacks. Current: $${(initialBurn * secondaryTokenPrice).toLocaleString()}`;
    }

    // Validate maximum 30% first epoch capture
    const remainingSupply = hardCap - parseInt(form.tge_allocation || '1');
    const initialReward = parseInt(form.initial_reward_per_burn_unit);
    if (!newErrors.initial_reward_per_burn_unit && remainingSupply > 0 && initialReward > 0) {
      const firstEpochPercent = (initialReward / remainingSupply) * 100;
      if (firstEpochPercent > 30) {
        newErrors.initial_reward_per_burn_unit = `First epoch would capture ${firstEpochPercent.toFixed(1)}% of supply - reduce initial reward to max 30% for fair distribution`;
      }
    }

    if (!newErrors.halving_step && (step < 25 || step > 99)) {
      newErrors.halving_step = `Halving Step must be between 25% and 99%.`;
    }

    setErrors(newErrors);
  }, [form]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFieldNames: Array<keyof TokenFormValues> = [
      'primary_max_supply',
      'initial_secondary_burn',
      'primary_max_phase_mint',
      'halving_step',
      'initial_reward_per_burn_unit'
    ];
    if (name === 'tge_allocation') return;

    if (numericFieldNames.includes(name as keyof TokenFormValues)) {
      if (value === '' || /^[0-9]+$/.test(value)) {
        setForm(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSliderChange = (fieldName: keyof TokenFormValues, newValue: number[]) => {
    if (fieldName === 'tge_allocation') return;
    setForm(prev => ({
      ...prev,
      [fieldName]: newValue[0].toString()
    }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (Object.keys(errors).length > 0) {
      return;
    }
    setLoadingModalV(true);
    if (!isAuthenticated || !principal) {
      setLoadingModalV(false);
      setErrorModalV({ flag: true, title: "Authentication Error", message: "Please log in to create a token." });
      return;
    }
    
    // Convert whole token values to e8s for the backend
    const formDataForBackend = {
      ...form,
      primary_max_supply: (BigInt(form.primary_max_supply) * BigInt(E8S)).toString(),
      initial_primary_mint: (BigInt(form.tge_allocation) * BigInt(E8S)).toString(),
      initial_secondary_burn: (BigInt(form.initial_secondary_burn) * BigInt(E8S)).toString(),
      primary_max_phase_mint: (BigInt(form.primary_max_phase_mint) * BigInt(E8S)).toString(),
      initial_reward_per_burn_unit: (BigInt(form.initial_reward_per_burn_unit) * BigInt(E8S)).toString(),
      halving_step: form.halving_step,
    };

    dispatch(createToken({ formData: formDataForBackend, userPrincipal: principal }));
    console.log('Submitting (converted to e8s):', formDataForBackend);
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'primary_token_logo_base64' | 'secondary_token_logo_base64'
  ) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setForm((prevForm) => ({
          ...prevForm,
          [field]: reader.result,
        }));
        if (errors[field]) {
          setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (lbryFun.success === true) {
      dispatch(lbryFunFlagHandler());
      setLoadingModalV(false);
      setSucessModalV(true);
      navigate('/token/success');
    } 
    if (lbryFun.error !== null) {
      setLoadingModalV(false);
     setErrorModalV({flag:true,title:lbryFun.error.title,message:lbryFun.error.message});
    }
  }, [lbryFun.success, lbryFun.error, dispatch, navigate]);

  const renderError = (fieldName: string) => {
    if (errors[fieldName]) {
      return (
        <p className="text-red-500 text-sm mt-1">{errors[fieldName]}</p>
      );
    }
    return null;
  };

  return (
    <div className='w-full px-4 sm:px-6 lg:px-8'>
      {/* Header */}
      <div className="text-center px-2 pb-8">
        <h1 className="text-5xl font-bold text-black text-foreground mb-6">Create Token</h1>
        {/* Tokenomics Explanation Start */}
        <details className="text-left mx-auto max-w-2xl my-4 border border-border rounded-xl bg-muted shadow-sm open:ring-1 open:ring-black/5 dark:open:ring-white/10">
          <summary className="text-md font-semibold p-3 cursor-pointer text-foreground hover:bg-muted/80 rounded-xl flex justify-between items-center">
            How it works
            <span className="text-xs transition-transform transform">▼</span>
          </summary>
          
          <div className="p-4 border-t border-border text-sm text-muted-foreground">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-gray-800 text-gray-200 mb-1">Secondary Tokens:</h4>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>Mint at a fixed rate of $0.01 in ICP.</li>
                  <li>Burn to create Primary Tokens & recover 50% of their initial ICP cost.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-gray-200 mb-1">Primary Tokens:</h4>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>No fixed price; created by burning Secondary Tokens.</li>
                  <li>Minting difficulty increases with each epoch (less Primary Token per Secondary Token burned over time).</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-gray-200 mb-1">ICP Revenue Flow (from Secondary Token minting):</h4>
                <ul className="list-disc list-inside pl-4 space-y-1">
                  <li>1% fee to ALEX stakers.</li>
                  <li>49.5% to Primary Token buybacks & locked liquidity.</li>
                  <li>49.5% to Primary Token staking rewards.</li>
                </ul>
              </div>
            </div>
          </div>
        </details>
        {/* Tokenomics Explanation End */}
      </div>

      <UserICPBalance />

      {/* Form tag now wraps all input sections and the submit button */}
      <form onSubmit={handleSubmit}>
        {/* Wrapper for Primary and Secondary Token Sections (Side-by-Side on Desktop) */}
        <div className="md:flex md:space-x-8">
          {/* Primary Token Section */}
          <div className="md:w-1/2 border-b-2 border-b-border pb-6 md:border-b-0 md:border-r-2 md:border-r-border md:pr-8">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Primary Token</h2>
            <div className="mb-4">
              <Label className="block text-lg font-medium text-foreground mb-4">
                Token Name<span className="text-red-500">* :</span>
              </Label>
              <Input
                name="primary_token_name"
                type="text"
                className={`w-full border rounded-2xl px-3 py-2 h-[60px] text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.primary_token_name ? 'border-red-500' : 'border-border'}`}
                placeholder="Enter Name for your token"
                value={form.primary_token_name}
                onChange={handleChange}
              />
              {renderError('primary_token_name')}
            </div>
            <div className="mb-4">
              <Label className="block text-lg font-medium text-foreground mb-4">
                Token Ticker<span className="text-red-500">*:</span>
              </Label>
              <Input
                name="primary_token_symbol"
                type="text"
                className={`w-full border rounded-2xl px-3 py-2 h-[60px] text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.primary_token_symbol ? 'border-red-500' : 'border-border'}`}
                placeholder="Enter the ticker (3–5 uppercase letters)"
                value={form.primary_token_symbol}
                onChange={handleChange}
              />
              {renderError('primary_token_symbol')}
            </div>
            <div className="mb-4">
              <Label className="block text-lg font-medium text-foreground mb-4">
                Description<span className="text-red-500">*:</span>
              </Label>
              <Textarea
                rows={4}
                className={`w-full border rounded-2xl px-3 py-2 text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.primary_token_description ? 'border-red-500' : 'border-border'}`}
                placeholder="Enter your description here"
                name='primary_token_description'
                value={form.primary_token_description}
                onChange={handleChange}
              />
              {renderError('primary_token_description')}
            </div>
            <div className="mb-4">
              <h4 className="text-sm text-muted-foreground mb-4">Describe what your token represents or how it's intended to be used</h4>
              <div className="flex align-items-center">
                <div className="w-[100px] h-[100px] me-4">
                  <img className="w-full object-contain" src={form.primary_token_logo_base64 || "images/thumbnail.png"} alt="thumbnail" />
                </div>
                <div className="">
                  <h5 className="mb-4 text-sm text-foreground">Primary Token Image (.svg) *</h5>
                  <div className="flex flex-col">
                    <label className="inline-block text-sm text-muted-foreground font-semibold rounded cursor-pointer">
                      <span className="bg-muted text-muted-foreground px-4 py-2 rounded-xl hover:bg-muted/80 transition">
                        Choose File
                      </span>
                      <Input
                        type="file"
                        accept="image/*"
                        name="primary_token_image"
                        onChange={(e) => handleImageUpload(e, 'primary_token_logo_base64')}
                        className="hidden"
                      />
                    </label>
                    {renderError('primary_token_logo_base64')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Token Section */}
          <div className="md:w-1/2 border-b-2 border-b-border py-6 md:border-b-0 md:pt-0 md:pl-8">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Secondary Token</h2>
            <div className="mb-4">
              <Label className="block text-lg font-bold text-foreground mb-4">
                Token Name<span className="text-red-500">* :</span>
              </Label>
              <Input
                name="secondary_token_name"
                type="text"
                className={`w-full border rounded-2xl px-3 py-2 h-[60px] text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.secondary_token_name ? 'border-red-500' : 'border-border'}`}
                placeholder="Enter Name for your token"
                value={form.secondary_token_name}
                onChange={handleChange}
              />
              {renderError('secondary_token_name')}
            </div>
            <div className="mb-4">
              <Label className="block text-lg font-medium text-foreground mb-4">
                Token Ticker<span className="text-red-500">*:</span>
              </Label>
              <Input
                name="secondary_token_symbol"
                type="text"
                className={`w-full border rounded-2xl px-3 py-2 h-[60px] text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.secondary_token_symbol ? 'border-red-500' : 'border-border'}`}
                placeholder="Enter the ticker (3–5 uppercase letters)"
                value={form.secondary_token_symbol}
                onChange={handleChange}
              />
              {renderError('secondary_token_symbol')}
            </div>
            <div className="mb-4">
              <Label className="block text-lg font-medium text-foreground mb-4">
                Description<span className="text-red-500">*:</span>
              </Label>
              <Textarea
                rows={4}
                className={`w-full border rounded-2xl px-3 py-2 text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.secondary_token_description ? 'border-red-500' : 'border-border'}`}
                placeholder="Enter your description here"
                name='secondary_token_description'
                value={form.secondary_token_description}
                onChange={handleChange}
              />
              {renderError('secondary_token_description')}
            </div>
            <div className="mb-4">
              <h4 className="text-sm text-muted-foreground mb-4">Describe what your token represents or how it's intended to be used</h4>
              <div className="flex align-items-center">
                <div className="w-[100px] h-[100px] me-4">
                  <img className="w-full object-contain" src={form.secondary_token_logo_base64 || "images/thumbnail.png"} alt="thumbnail" />
                </div>
                <div className="">
                  <h5 className="mb-4 text-sm text-foreground">Secondary Token Image (.svg) *</h5>
                  <div className="flex flex-col">
                    <label className="inline-block text-sm text-muted-foreground font-semibold rounded cursor-pointer">
                      <span className="bg-muted text-muted-foreground px-4 py-2 rounded-xl hover:bg-muted/80 transition">
                        Choose File
                      </span>
                      <Input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        name="secondary_token_image"
                        onChange={(e) => { handleImageUpload(e, 'secondary_token_logo_base64') }}
                      />
                    </label>
                    {renderError('secondary_token_logo_base64')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Parameter Presets */}
        <div className="py-6 border-t-2 border-t-border md:border-t-0">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Parameter Presets</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              type="button"
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  initial_secondary_burn: '200000',
                  initial_reward_per_burn_unit: '100',
                  halving_step: '35',
                  primary_max_phase_mint: prev.primary_max_phase_mint || '50000'
                }));
              }}
              className="p-4 border-2 border-border rounded-lg hover:border-primary transition-colors"
            >
              <h3 className="font-semibold text-foreground mb-2">Extended Distribution</h3>
              <p className="text-sm text-muted-foreground">15+ epochs</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Initial valuation: $1,000</p>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  initial_secondary_burn: '500000',
                  initial_reward_per_burn_unit: '500',
                  halving_step: '45',
                  primary_max_phase_mint: prev.primary_max_phase_mint || '50000'
                }));
              }}
              className="p-4 border-2 border-border rounded-lg hover:border-primary transition-colors"
            >
              <h3 className="font-semibold text-foreground mb-2">Balanced</h3>
              <p className="text-sm text-muted-foreground">8-12 epochs</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Initial valuation: $2,500</p>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  initial_secondary_burn: '1000000',
                  initial_reward_per_burn_unit: '2000',
                  halving_step: '70',
                  primary_max_phase_mint: prev.primary_max_phase_mint || '50000'
                }));
              }}
              className="p-4 border-2 border-border rounded-lg hover:border-primary transition-colors"
            >
              <h3 className="font-semibold text-foreground mb-2">Quick Launch</h3>
              <p className="text-sm text-muted-foreground">3-5 epochs</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Initial valuation: $5,000</p>
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Select a preset above or customize parameters below
          </p>
        </div>

        {/* Supply Settings Inputs first */}
        <div className="py-6 border-t-2 border-t-border md:border-t-0">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Supply Settings</h2>
          {/* This div becomes the grid container for supply parameters */}
          <div className="md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-6">
            {/* primary_max_supply input and slider - Grid Item 1 */}
            <div className="mb-4 md:mb-0"> {/* Adjusted margin for grid layout */}
              <div className="flex items-center mb-1">
                <Label className="block text-lg font-medium text-foreground me-2">
                  Hard Cap <span className="text-red-500">* :</span>
                </Label>
                <TooltipIcon 
                  text="The absolute maximum number of Primary Tokens that can ever exist. This includes initial minting and all tokens from the burning schedule."
                />
              </div>
              <Input
                name="primary_max_supply"
                type="text"
                className={`w-full border rounded-2xl px-3 py-2 h-[60px] mb-2 text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.primary_max_supply ? 'border-red-500' : 'border-border'}`}
                placeholder="e.g. 10000000"
                value={form.primary_max_supply}
                onChange={handleChange}
              />
              {renderError('primary_max_supply')}
              <Slider
                min={100000}
                max={10000000}
                step={1000}
                value={[parseInt(form.primary_max_supply) || 0]}
                onValueChange={(value) => handleSliderChange('primary_max_supply', value)}
                disabled={!form.primary_max_supply}
              />
            </div>
            {/* initial_reward_per_burn_unit input and slider - Grid Item 2 */}
            <div className="mb-4 md:mb-0">
              <div className="flex items-center mb-1">
                <Label className="block text-lg font-medium text-foreground me-2">
                  Initial Reward per Burn Unit <span className="text-red-500">*:</span>
                </Label>
                <TooltipIcon
                  text="The number of Primary Tokens that will be minted when the 'Burn Unit' is met for the first time. This sets the starting rate for the entire minting schedule."
                />
              </div>
              <Input
                name="initial_reward_per_burn_unit"
                type="text"
                className={`w-full border rounded-2xl px-3 py-2 h-[60px] mb-2 text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.initial_reward_per_burn_unit ? 'border-red-500' : 'border-border'}`}
                placeholder="e.g. 20000"
                value={form.initial_reward_per_burn_unit}
                onChange={handleChange}
              />
              {renderError('initial_reward_per_burn_unit')}
              <Slider
                min={10}
                max={Math.min(100000, Math.floor((parseInt(form.primary_max_supply || '0') - parseInt(form.tge_allocation || '1')) * 0.1)) || 100000}
                step={10}
                value={[parseInt(form.initial_reward_per_burn_unit) || 0]}
                onValueChange={(value) => handleSliderChange('initial_reward_per_burn_unit', value)}
                disabled={!form.initial_reward_per_burn_unit}
              />
              {form.primary_max_supply && (
                <p className="text-xs text-gray-500 text-gray-400 mt-1">
                  Max: {Math.floor((parseInt(form.primary_max_supply) - parseInt(form.tge_allocation || '1')) * 0.1).toLocaleString()} (10% of remaining supply)
                </p>
              )}
            </div>
            {/* initial_secondary_burn input and slider - Grid Item 3 */}
            <div className="mb-4 md:mb-0"> {/* Adjusted margin for grid layout */}
              <div className="flex items-center mb-1">
                <Label className="block text-lg font-medium text-foreground me-2">
                  Burn Unit <span className="text-red-500">*:</span>
                </Label>
                <TooltipIcon 
                  text="The amount of Secondary Tokens that need to be burned to complete the FIRST epoch of the Primary Token minting schedule. Subsequent epochs will require more burns."
                />
              </div>
              <Input
                type="text"
                name='initial_secondary_burn'
                className={`w-full border rounded-2xl px-3 py-2 h-[60px] mb-2 text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.initial_secondary_burn ? 'border-red-500' : 'border-border'}`}
                placeholder="e.g. 50000 tokens"
                value={form.initial_secondary_burn}
                onChange={handleChange}
              />
              {renderError('initial_secondary_burn')}
              <Slider
                min={200000}
                max={10000000}
                step={10000}
                value={[parseInt(form.initial_secondary_burn) || 0]}
                onValueChange={(value) => handleSliderChange('initial_secondary_burn', value)}
                disabled={!form.initial_secondary_burn}
              />
              {form.initial_secondary_burn && (
                <>
                  <p className="text-xs text-gray-500 text-gray-400 mt-1">
                    Initial Valuation: ${(parseInt(form.initial_secondary_burn) * 0.005).toLocaleString()} USD
                  </p>
                  {parseInt(form.initial_secondary_burn) * 0.005 < 1000 && (
                    <p className="text-xs text-yellow-600 text-yellow-400 mt-1">
                      ⚠️ Initial valuation below $1,000 threshold - vulnerable to bot attacks
                    </p>
                  )}
                </>
              )}
            </div>
            {/* primary_max_phase_mint input and slider - Grid Item 4 */}
            <div className="mb-10 md:mb-0"> {/* Adjusted margin for grid layout, was mb-10 */}
               <div className="flex items-center mb-1">
                <Label className="block text-lg font-medium text-foreground me-2">
                  Mint Cap <span className="text-red-500">*:</span>
                </Label>
                <TooltipIcon 
                  text="A cap on how many Primary Tokens can be minted in any single burn transaction, regardless of how many Secondary Tokens are burned. This smooths out supply."
                />
              </div>
              <Input
                type="text"
                name='primary_max_phase_mint'
                className={`w-full border rounded-2xl px-3 py-2 h-[60px] mb-2 text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.primary_max_phase_mint ? 'border-red-500' : 'border-border'}`}
                placeholder="e.g. 1000 per phase"
                value={form.primary_max_phase_mint}
                onChange={handleChange}
              />
              {renderError('primary_max_phase_mint')}
              <Slider
                min={100}
                max={100000}
                step={100}
                value={[parseInt(form.primary_max_phase_mint) || 0]}
                onValueChange={(value) => handleSliderChange('primary_max_phase_mint', value)}
                disabled={!form.primary_max_phase_mint}
              />
            </div>
            {/* halving_step input and slider - Grid Item 5 */}
            <div className="mb-10 md:mb-0">
              <div className="flex items-center mb-1">
                <Label className="block text-lg font-medium text-foreground me-2">
                  Halving Step (%) <span className="text-red-500">*:</span>
                </Label>
                <TooltipIcon
                  text="The percentage by which the minting reward is multiplied each epoch. A value < 50% causes tokens minted per epoch to decrease (front-loaded). A value > 50% causes tokens minted per epoch to increase (back-loaded)."
                />
              </div>
              <Input
                type="text"
                name='halving_step'
                className={`w-full border rounded-2xl px-3 py-2 h-[60px] mb-2 text-muted-foreground placeholder:text-muted-foreground bg-input text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm ${errors.halving_step ? 'border-red-500' : 'border-border'}`}
                placeholder="e.g. 50"
                value={form.halving_step}
                onChange={handleChange}
              />
              {renderError('halving_step')}
              {halvingStepWarning && <p className="text-yellow-600 text-yellow-400 text-sm mt-1">{halvingStepWarning}</p>}
              <Slider
                min={25}
                max={99}
                step={1}
                value={[parseInt(form.halving_step) || 0]}
                onValueChange={(value) => handleSliderChange('halving_step', value)}
                disabled={!form.halving_step}
              />
            </div>
          </div>
        </div>

        {/* Parameter Validation Warnings */}
        <div className="space-y-2">
          {(form.initial_reward_per_burn_unit && form.primary_max_supply && 
            parseInt(form.initial_reward_per_burn_unit) > (parseInt(form.primary_max_supply) - parseInt(form.tge_allocation || '1')) * 0.1) && (
            <div className="mt-4 p-3 bg-yellow-50 bg-yellow-900/20 border border-yellow-200 border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 text-yellow-200">
                ⚠️ High reward exceeds 10% of remaining supply - this enables unfair launches where bots can monopolize early epochs. Reduce initial reward to ensure at least 3 meaningful distribution epochs.
              </p>
            </div>
          )}
          
          {previewGraphData && previewGraphData.minted_per_epoch_data_y && (
            <>
              {previewGraphData.minted_per_epoch_data_y.length < 3 && (
                <div className="mt-4 p-3 bg-red-50 bg-red-900/20 border border-red-200 border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 text-red-200">
                    🚨 UNFAIR LAUNCH: Only {previewGraphData.minted_per_epoch_data_y.length} epochs - insufficient time for community participation. Minimum 3 epochs required to prevent bot monopolization.
                  </p>
                </div>
              )}
              
              {previewGraphData.minted_per_epoch_data_y.length > 30 && (
                <div className="mt-4 p-3 bg-yellow-50 bg-yellow-900/20 border border-yellow-200 border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 text-yellow-200">
                    ⚠️ Extended distribution ({previewGraphData.minted_per_epoch_data_y.length} epochs) may reduce liquidity - consider adjusting parameters
                  </p>
                </div>
              )}
            </>
          )}
        </div>

          <div className='my-8 border-t-4 border-dashed border-border'></div>

          <TokenomicsGraphsBackend
              primaryMaxSupply={form.primary_max_supply}
              tgeAllocation={form.tge_allocation}
              initialSecondaryBurn={form.initial_secondary_burn}
              halvingStep={form.halving_step}
              initialRewardPerBurnUnit={form.initial_reward_per_burn_unit}
          />

        {/* Submit Button Section */}
        <div className="text-center mt-12">
          <Button
            type="submit"
            disabled={Object.keys(errors).length > 0}
            variant="default"
            size="lg"
            className="min-w-[300px] lg:h-14 md:h-12 sm:h-10 xs:h-10 lg:px-7 md:px-5 sm:px-4 xs:px-2 lg:text-lg md:text-base text-sm"
          >
            Create Token
          </Button>
        </div>
      </form> {/* End of form element */}

      <LoadingModal show={loadingModalV} message1={"Creating Tokens"} message2={" This may take a few moments."} setShow={setLoadingModalV} />
      <SuccessModal show={successModalV} setShow={setSucessModalV} />
      <ErrorModal show={errorModalV.flag} setShow={setErrorModalV} title={errorModalV.title} message={errorModalV.message} />

    </div>
  );
};

export default CreateTokenForm;