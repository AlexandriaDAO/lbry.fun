import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { Button } from '@/lib/components/button';
import { Input } from '@/lib/components/input';
import { Textarea } from '@/lib/components/textarea';
import { Label } from '@/lib/components/label';
import { Card } from '@/lib/components/card';
import { Slider } from '@/lib/components/slider';
import createToken from './thunk/createToken.thunk';
import { useAppDispatch } from '@/store/hooks/useAppDispatch';
import { useAppSelector } from '@/store/hooks/useAppSelector';
import LoadingModal from '../swap/components/loadingModal';
import { lbryFunFlagHandler } from './thunk/lbryFunSlice';

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
    const formattedForm = {
      ...form,
      primary_max_supply: form.primary_max_supply,
      initial_primary_mint: form.initial_primary_mint,
      initial_secondary_burn: form.initial_secondary_burn,
      primary_max_phase_mint: form.primary_max_phase_mint
    };
    dispatch(createToken({ formData: formattedForm, userPrincipal: user.principal }));

    console.log('Submitting:', formattedForm);
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
    if (lbryFun.loading === true) {
      setLoadingModalV(true);
    } else {
      setLoadingModalV(false);
    }
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
      <div className="max-w-4xl mx-auto space-y-8 border border-gray-400 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white py-5 px-7 rounded-borderbox mb-3">
        <form onSubmit={handleSubmit}>
          <h2 className="text-3xl font-bold text-center mb-4">Create Token</h2>

          {/* --- PRIMARY TOKEN --- */}
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Primary Token</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="primary_token_symbol">Symbol</Label>
                <Input name="primary_token_symbol" value={form.primary_token_symbol} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="primary_token_name">Name</Label>
                <Input name="primary_token_name" value={form.primary_token_name} onChange={handleChange} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="primary_token_description">Description</Label>
                <Textarea name="primary_token_description" value={form.primary_token_description} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="primary_token_image">Primary Token Image (SVG)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  name="primary_token_image"
                  onChange={(e) => { handleImageUpload(e, 'primary_token_logo_base64') }}
                />
                {form.primary_token_logo_base64 && (
                  <img
                    src={form.primary_token_logo_base64}
                    alt="Token Logo Preview"
                    className="mt-4 max-h-32 rounded border"
                  />
                )}

              </div>
            </div>
          </Card>

          {/* --- SECONDARY TOKEN --- */}
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Secondary Token</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="secondary_token_symbol">Symbol</Label>
                <Input name="secondary_token_symbol" value={form.secondary_token_symbol} onChange={handleChange} />
              </div>
              <div>
                <Label htmlFor="secondary_token_name">Name</Label>
                <Input name="secondary_token_name" value={form.secondary_token_name} onChange={handleChange} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="secondary_token_description">Description</Label>
                <Textarea name="secondary_token_description" value={form.secondary_token_description} onChange={handleChange} />
              </div>

              <div>
                <Label htmlFor="secondary_token_image">Secondary Token Image (SVG)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  name="secondary_token_image"
                  onChange={(e) => { handleImageUpload(e, 'secondary_token_logo_base64') }}
                />
                {form.secondary_token_logo_base64 && (
                  <img
                    src={form.secondary_token_logo_base64}
                    alt="Token Logo Preview"
                    className="mt-4 max-h-32 rounded border"
                  />
                )}

              </div>
            </div>
          </Card>

          {/* --- SUPPLY SETTINGS --- */}
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Supply Settings</h3>
            <div className="space-y-6">
              <div>
                <Label htmlFor="primary_max_supply">
                  Primary Max Supply: {form.primary_max_supply}
                </Label>
                <Slider
                  min={1000}
                  max={21000000}
                  step={1000}
                  value={[parseInt(form.primary_max_supply)]}
                  onValueChange={handleSliderChange}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="initial_primary_mint">Initial Primary Mint</Label>
                  <Input
                    type="number"
                    name="initial_primary_mint"
                    value={form.initial_primary_mint}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="initial_secondary_burn">Initial Secondary Burn</Label>
                  <Input
                    type="number"
                    name="initial_secondary_burn"
                    value={form.initial_secondary_burn}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="primary_max_phase_mint">Primary Max Phase Mint</Label>
                  <Input
                    type="number"
                    name="primary_max_phase_mint"
                    value={form.primary_max_phase_mint}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* --- SUBMIT --- */}
          <div className="text-center">
            <Button type="submit" className="px-6 py-3 text-lg">
              Create Token
            </Button>
          </div>
        </form>
      </div>

      <LoadingModal show={loadingModalV} message1={"Creating Tokens"} message2={" This may take a few moments."} setShow={setLoadingModalV} />

    </div>
  );
};

export default CreateTokenForm;
