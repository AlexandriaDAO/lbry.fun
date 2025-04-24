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
import { lbryFunFlagHandler } from '../thunk/lbryFunSlice';
import { Form } from 'antd/es';
import UserICPBalance from './userICPBalance';

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
  initial_primary_mint: string;
  initial_secondary_burn: string;
  primary_max_phase_mint: string;

}

const CreateTokenForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const lbryFun = useAppSelector(state => state.lbryFun);
  const [loadingModalV, setLoadingModalV] = useState(false);
  const [successModalV, setSucessModalV] = useState(false);
  const { user } = useAppSelector((state) => state.auth);

  const [form, setForm] = useState<TokenFormValues>({
    primary_token_symbol: '',
    primary_token_name: '',
    primary_token_description: '',
    secondary_token_symbol: '',
    secondary_token_name: '',
    secondary_token_description: '',
    secondary_token_logo_base64: '',
    primary_max_supply: '1000',
    initial_primary_mint: '',
    initial_secondary_burn: '',
    primary_max_phase_mint: '',
    primary_token_logo_base64: ''
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSliderChange = (value: number[]) => {
    setForm(prev => ({
      ...prev,
      primary_max_supply: value[0].toString()
    }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      return;
    }
    setLoadingModalV(true);

    const formattedForm = {
      ...form,
      primary_max_supply: BigInt(form.primary_max_supply),
      initial_primary_mint: BigInt(form.initial_primary_mint),
      initial_secondary_burn: BigInt(form.initial_secondary_burn),
      primary_max_phase_mint: BigInt(form.primary_max_phase_mint),
    };

    dispatch(createToken({ formData: form, userPrincipal: user.principal }));

    console.log('Submitting:', form);
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
      }
    };

    reader.readAsDataURL(file);
  };
  useEffect(() => {
  
    if (lbryFun.success === true) {
      dispatch(lbryFunFlagHandler());
      setLoadingModalV(false);
      setSucessModalV(true);
    } else {
      setSucessModalV(false);
    }

  }, [lbryFun])


  return (
    <div className='container'>
      {/* Header */}

      <div className="text-center px-2 pb-8">
        <h1 className="text-5xl font-bold text-black text-foreground mb-6">Create Token</h1>
        <p className="text-black mt-1 text-xl text-foreground">Create custom tokens within the Alexandria Protocol — modular, interoperable, and built for the networked knowledge layer.</p>
      </div>

      {/* ICP Balance + Notice */}
      <UserICPBalance />


      <form onSubmit={handleSubmit}>
        <div className="border-b-2 border-b-[#E2E8F0]">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Primary Token</h2>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Token Name<span className="text-red-500">* :</span>
            </Label>
            <Input
              name="primary_token_name"
              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border  h-[60px]"
              placeholder="Enter Name for your token"
              value={form.primary_token_name} onChange={handleChange}
            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Token Ticker<span className="text-red-500">*:</span>
            </Label>
            <Input
              name="primary_token_symbol"

              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border  h-[60px]"
              placeholder="Enter the ticker (3–5 uppercase letters)"
              value={form.primary_token_symbol} onChange={handleChange}
            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Description<span className="text-red-500">*:</span>
            </Label>

            <Textarea
              rows={4}
              className="
               w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border  h-[60px]"
              placeholder="Enter your description here"
              name='primary_token_description'
              value={form.primary_token_description} onChange={handleChange}

            />
          </div>
          <div className="mb-4">
            <h4 className="text-[#64748B] dark-text-[#000] text-sm text-foreground mb-4">Describe what your token represents or how it’s intended to be used</h4>
            <div className="flex align-items-center">
              <div className="w-[100px] h-[100px] me-4">
                <img className="w-full object-contain" src={form.primary_token_logo_base64 || "images/thumbnail.png"} alt="thumbnail" />
              </div>
              <div className="">
                <h5 className="mb-4 text-foreground text-sm text-[#000] dark:text-[white]">Primary Token Image (.svg) *</h5>
                <div className="flex align-items-center">
                  <label className="inline-block text-sm text-[#3C3C3C] font-semibold rounded cursor-pointer">
                    <span className="bg-[#E2E8F0] text-[#000] dark:text-white dark:bg-[#444] px-4 py-2 rounded-xl hover:bg-[#CBD5E1] dark:hover:bg-[#555] transition">
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

                </div>

              </div>
            </div>

          </div>
        </div>

        <div className="border-b-2 border-b-[#E2E8F0]">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Secondary Token</h2>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Token Name<span className="text-red-500">* :</span>
            </Label>
            <Input
              name="secondary_token_name"

              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border  h-[60px]"
              placeholder="Enter Name for your token"
              value={form.secondary_token_name} onChange={handleChange}

            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Token Ticker<span className="text-red-500">*:</span>
            </Label>
            <Input
              name="secondary_token_symbol"

              type="text"
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border  h-[60px]"
              placeholder="Enter the ticker (3–5 uppercase letters)"
              value={form.secondary_token_symbol} onChange={handleChange}

            />
          </div>
          <div className="mb-4">
            <Label className="block text-lg font-medium text-foreground mb-4">
              Description<span className="text-red-500">*:</span>
            </Label>

            <Textarea
              rows={4}
              className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border  "
              placeholder="Enter your description here"
              name='secondary_token_description'
              value={form.secondary_token_description}
              onChange={handleChange}

            />
          </div>
          <div className="mb-4">
            <h4 className="text-[#64748B] text-sm text-foreground mb-4">Describe what your token represents or how it’s intended to be used</h4>
            <div className="flex align-items-center">
              <div className="w-[100px] h-[100px] me-4">
                <img className="w-full object-contain" src={form.secondary_token_logo_base64 || "images/thumbnail.png"} alt="thumbnail" />
              </div>
              <div className="">
                <h5 className="mb-4 text-foreground text-sm text-[#000]">Primary Token Image (.svg) *</h5>
                <div className="flex align-items-center">
                  <label className="inline-block text-sm text-[#3C3C3C] font-semibold rounded cursor-pointer">
                    <span className="bg-[#E2E8F0] text-[#000] dark:text-white dark:bg-[#444] px-4 py-2 rounded-xl hover:bg-[#CBD5E1] dark:hover:bg-[#555] transition">
                      Choose File
                    </span>
                    <Input
                      type="file"
                      // accept=".svg"
                      className="hidden text-[#3C3C3C] placeholder:text-[#3C3C3C] placeholder:bg-[#F1F5F9]  w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-[@F1F5F9] text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border"
                      placeholder="Choose a file"
                      accept="image/*"
                      name="secondary_token_image"
                      onChange={(e) => { handleImageUpload(e, 'secondary_token_logo_base64') }}
                    />
                  </label>

                </div>

              </div>
            </div>

          </div>
        </div>

        {/* Upcoming Tokens */}
        <div className="">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Supply Settings</h2>
          <div className="mb-10">
            <div className="mb-4">
              <div className="flex items-center mb-4">
                <div>
                  <Label className="block text-lg font-medium text-foreground mb-4 me-4">
                    Primary Max Supply <span className="text-red-500">* :</span>
                  </Label>
                </div>
                <div className="border border-[#E2E8F0] min-w-[70px] min-h-[50px] rounded-2xl p-4 d-flex align-items-center justify-content-center">
                  <p className="text-[#64748B] text-sm text-foreground">{parseInt(form.primary_max_supply)}</p>
                </div>
              </div>
              <Slider
                min={1000}
                max={21000000}
                step={1000}
                value={[parseInt(form.primary_max_supply)]}
                onValueChange={handleSliderChange}
              />

            </div>
            <div className="mb-4">
              <Label className="block text-lg font-medium text-foreground mb-4">
                Initial Primary Mint <span className="text-red-500">*:</span>
              </Label>
              <Input
                name='initial_primary_mint'
                type="text"
                className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border  h-[60px]"
                placeholder="e.g. 1000 tokens to creator at launch"
                value={form.initial_primary_mint} onChange={handleChange}

              />
            </div>
            <div className="mb-4">
              <Label className="block text-lg font-medium text-foreground mb-4">
                Initial Secondary Burn <span className="text-red-500">*:</span>
              </Label>
              <Input
                type="text"
                name='initial_secondary_burn'
                className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border  h-[60px]"
                placeholder="e.g. 1000 tokens to creator at launch"
                value={form.initial_secondary_burn} onChange={handleChange}

              />
            </div>
            <div className="mb-10">
              <Label className="block text-lg font-medium text-foreground mb-4">
                Primary Max Phase Mint  <span className="text-red-500">*:</span>
              </Label>
              <Input
                type="text"
                name='primary_max_phase_mint'
                className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-[#64748B] placeholder:text-[#64748B]   
                  bg-white text-black dark:bg-gray-800 dark:text-foreground file:border-0 file:bg-transparent file:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 border-gray-400 focus-visible:ring-gray-700 placeholder:text-muted-foreground text-sm file:text-lg placeholder:text-sm w-full rounded-2xl px-3 py-2 border  h-[60px]"
                placeholder="e.g. 1000 per phase"
                value={form.primary_max_phase_mint} onChange={handleChange}

              />
            </div>
            <div className="text-center">
              <Button
                type="submit"
                className="inline-flex gap-2 items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-all duration-100 ease-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2  h-10 px-4 bg-[#0F172A] lg:h-14 md:h-12 sm:h-10 xs:h-10 lg:px-7 md:px-5 sm:px-4 xs:px-2 text-white lg:text-lg md:text-base text-sm border-2 border-[#353535] rounded-xl hover:bg-white hover:text-[#353535] dark:bg-[#353230] dark:border-[#353230] dark:text-[#fff] hover:dark:border-[#353230] hover:dark:text-[#fff] hover:dark:bg-[transparent] min-w-[300px] hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
              >

                Create Token
              </Button>
            </div>

          </div>
        </div>
      </form>

      <LoadingModal show={loadingModalV} message1={"Creating Tokens"} message2={" This may take a few moments."} setShow={setLoadingModalV} />

    </div>
  );
};

export default CreateTokenForm;
