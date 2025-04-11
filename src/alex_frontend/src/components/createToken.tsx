import React, { useState, ChangeEvent, FormEvent } from 'react';

interface TokenFormValues {
  primary_token_symbol: string;
  primary_token_name: string;
  primary_token_description: string;
  secondary_token_symbol: string;
  secondary_token_name: string;
  secondary_token_description: string;
  primary_max_supply: string;
  initial_primary_mint: string;
  initial_secondary_burn: string;
  primary_max_phase_mint: string;
}

interface CreateTokenFormProps {
  onSubmit: (data: {
    primary_token_symbol: string;
    primary_token_name: string;
    primary_token_description: string;
    secondary_token_symbol: string;
    secondary_token_name: string;
    secondary_token_description: string;
    primary_max_supply: bigint;
    initial_primary_mint: bigint;
    initial_secondary_burn: bigint;
    primary_max_phase_mint: bigint;
  }) => void;
}

const CreateTokenForm: React.FC<CreateTokenFormProps> = ({ onSubmit }) => {
  const [form, setForm] = useState<TokenFormValues>({
    primary_token_symbol: '',
    primary_token_name: '',
    primary_token_description: '',
    secondary_token_symbol: '',
    secondary_token_name: '',
    secondary_token_description: '',
    primary_max_supply: '1000',
    initial_primary_mint: '',
    initial_secondary_burn: '',
    primary_max_phase_mint: ''
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formattedForm = {
      ...form,
      primary_max_supply: BigInt(form.primary_max_supply),
      initial_primary_mint: BigInt(form.initial_primary_mint),
      initial_secondary_burn: BigInt(form.initial_secondary_burn),
      primary_max_phase_mint: BigInt(form.primary_max_phase_mint)
    };

    onSubmit(formattedForm);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Token</h2>

      <label>Primary Token Symbol:
        <input type="text" name="primary_token_symbol" value={form.primary_token_symbol} onChange={handleChange} />
      </label>

      <label>Primary Token Name:
        <input type="text" name="primary_token_name" value={form.primary_token_name} onChange={handleChange} />
      </label>

      <label>Primary Token Description:
        <textarea name="primary_token_description" value={form.primary_token_description} onChange={handleChange} />
      </label>

      <label>Secondary Token Symbol:
        <input type="text" name="secondary_token_symbol" value={form.secondary_token_symbol} onChange={handleChange} />
      </label>

      <label>Secondary Token Name:
        <input type="text" name="secondary_token_name" value={form.secondary_token_name} onChange={handleChange} />
      </label>

      <label>Secondary Token Description:
        <textarea name="secondary_token_description" value={form.secondary_token_description} onChange={handleChange} />
      </label>

      <label>
        Primary Max Supply: {form.primary_max_supply}
        <input
          type="range"
          name="primary_max_supply"
          min="1000"
          max="21000000"
          step="1000"
          value={form.primary_max_supply}
          onChange={handleChange}
        />
      </label>

      <label>Initial Primary Mint:
        <input type="number" name="initial_primary_mint" value={form.initial_primary_mint} onChange={handleChange} />
      </label>

      <label>Initial Secondary Burn:
        <input type="number" name="initial_secondary_burn" value={form.initial_secondary_burn} onChange={handleChange} />
      </label>

      <label>Primary Max Phase Mint:
        <input type="number" name="primary_max_phase_mint" value={form.primary_max_phase_mint} onChange={handleChange} />
      </label>

      <button type="submit">Create Token</button>
    </form>
  );
};

export default CreateTokenForm;
