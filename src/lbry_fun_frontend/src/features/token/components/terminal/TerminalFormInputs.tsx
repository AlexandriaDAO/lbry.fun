import React from 'react';

interface TerminalInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  name?: string;
  required?: boolean;
}

export const TerminalInput: React.FC<TerminalInputProps> = ({ 
  label, 
  value, 
  onChange,
  onBlur, 
  error,
  placeholder,
  name,
  required = false
}) => {
  return (
    <div className="terminal-field">
      <div className="terminal-input-line">
        <span className="terminal-prompt">&gt;</span>
        <span className="terminal-label">{label}{required && '*'}:</span>
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="terminal-input"
        />
      </div>
      {error && <div className="terminal-error">[ERROR] {error}</div>}
    </div>
  );
};

interface TerminalTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  name?: string;
  rows?: number;
  required?: boolean;
}

export const TerminalTextarea: React.FC<TerminalTextareaProps> = ({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  name,
  rows = 3,
  required = false
}) => {
  return (
    <div className="terminal-field">
      <span className="terminal-label">{label}{required && '*'}:</span>
      <textarea
        name={name}
        className="terminal-textarea"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
      />
      {error && <div className="terminal-error">[ERROR] {error}</div>}
    </div>
  );
};

interface TerminalSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  name?: string;
  required?: boolean;
}

export const TerminalSelect: React.FC<TerminalSelectProps> = ({
  label,
  value,
  onChange,
  options,
  error,
  name,
  required = false
}) => {
  return (
    <div className="terminal-field">
      <span className="terminal-label">{label}{required && '*'}:</span>
      <select
        name={name}
        className="terminal-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <div className="terminal-error">[ERROR] {error}</div>}
    </div>
  );
};

interface TerminalRangeProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  step?: number;
  error?: string;
  warning?: string;
  name?: string;
  required?: boolean;
  suffix?: string;
  helperText?: string;
}

export const TerminalRange: React.FC<TerminalRangeProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  error,
  warning,
  name,
  required = false,
  suffix = '',
  helperText
}) => {
  return (
    <div className="terminal-field">
      <div className="terminal-range-display">
        <span className="terminal-label">{label}{required && '*'}:</span>
        <span className="terminal-value">{value}{suffix}</span>
      </div>
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="terminal-range"
      />
      {helperText && <div className="terminal-helper">{helperText}</div>}
      {warning && <div className="terminal-warning">[WARN] {warning}</div>}
      {error && <div className="terminal-error">[ERROR] {error}</div>}
    </div>
  );
};

interface TerminalFileInputProps {
  label: string;
  value: string;
  onChange: (base64: string) => void;
  error?: string;
  accept?: string;
  name?: string;
  required?: boolean;
}

export const TerminalFileInput: React.FC<TerminalFileInputProps> = ({
  label,
  value,
  onChange,
  error,
  accept = "image/*",
  name,
  required = false
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="terminal-field">
      <div className="terminal-file-input">
        <span className="terminal-label">{label}{required && '*'}:</span>
        <label className="terminal-file-label">
          <span className="terminal-command">
            &gt; select_file
          </span>
          <input
            type="file"
            name={name}
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        {value && (
          <div className="terminal-file-preview">
            <img src={value} alt="preview" className="terminal-file-thumbnail" />
          </div>
        )}
      </div>
      {error && <div className="terminal-error">[ERROR] {error}</div>}
    </div>
  );
};

// Status component for loading/error states
interface TerminalStatusProps {
  status?: {
    type: 'loading' | 'success' | 'error' | 'idle';
    message?: string;
  };
}

export const TerminalStatus: React.FC<TerminalStatusProps> = ({ status }) => {
  if (!status || status.type === 'idle') return null;
  
  return (
    <div className="terminal-status-bar">
      {status.type === 'loading' && (
        <span className="terminal-status">[PROCESSING...] {status.message || 'Please wait'}</span>
      )}
      {status.type === 'success' && (
        <span className="terminal-success">[SUCCESS] {status.message || 'Operation completed'}</span>
      )}
      {status.type === 'error' && (
        <span className="terminal-error">[ERROR] {status.message || 'Operation failed'}</span>
      )}
    </div>
  );
};