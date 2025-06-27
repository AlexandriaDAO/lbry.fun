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
  accept = "image/svg+xml",
  name,
  required = false
}) => {
  const [fileError, setFileError] = React.useState<string>('');
  const [isValidating, setIsValidating] = React.useState<boolean>(false);
  const [renderValid, setRenderValid] = React.useState<boolean>(false);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    
    // Clear previous errors
    setFileError('');
    
    // Validate file type
    if (file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg')) {
      setFileError('Only SVG files are allowed. Please upload a .svg file.');
      e.target.value = ''; // Clear the input
      onChange(''); // Clear the value
      return;
    }
    
    // Validate file size (max 100KB for SVG)
    const maxSize = 100 * 1024; // 100KB
    if (file.size > maxSize) {
      setFileError('SVG file is too large. Maximum size is 100KB.');
      e.target.value = ''; // Clear the input
      onChange(''); // Clear the value
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      if (typeof reader.result === 'string') {
        // Extract base64 data without the data URL prefix
        const base64Match = reader.result.match(/^data:image\/svg\+xml;base64,(.+)$/);
        if (base64Match && base64Match[1]) {
          setIsValidating(true);
          
          // Decode base64 to check SVG content
          try {
            const svgContent = atob(base64Match[1]);
            
            // Check for embedded images or external references
            const hasEmbeddedImages = /<image/.test(svgContent) || /xlink:href/.test(svgContent);
            const hasDataUri = /data:image\/(png|jpeg|jpg|gif|webp)/i.test(svgContent);
            const hasExternalRefs = /href=["'](?!#|data:)/.test(svgContent);
            
            if (hasEmbeddedImages || hasDataUri) {
              setFileError('SVG contains embedded images. Please use pure vector graphics only.');
              onChange('');
              setIsValidating(false);
              return;
            }
            
            if (hasExternalRefs) {
              setFileError('SVG contains external references. Please use a self-contained SVG.');
              onChange('');
              setIsValidating(false);
              return;
            }
            
            // If content checks pass, set the value and wait for render validation
            onChange(base64Match[1]);
            setRenderValid(false); // Reset until image loads
          } catch (e) {
            setFileError('Invalid SVG file - could not decode.');
            onChange('');
            setIsValidating(false);
          }
        } else {
          setFileError('Invalid SVG file format.');
          onChange('');
        }
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read file.');
      onChange('');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="terminal-field">
      <div className="terminal-file-input">
        <span className="terminal-label">{label}{required && '*'}:</span>
        <label className="terminal-file-label">
          <span className="terminal-command">
            &gt; select_svg_file
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
            <img 
              src={`data:image/svg+xml;base64,${value}`} 
              alt="preview" 
              className="terminal-file-thumbnail"
              onLoad={() => {
                setRenderValid(true);
                setIsValidating(false);
                setFileError(''); // Clear any errors if render succeeds
              }}
              onError={() => {
                setRenderValid(false);
                setIsValidating(false);
                setFileError('SVG failed to render. Please use a simpler SVG format.');
                onChange(''); // Clear the value if render fails
              }}
            />
            {isValidating && (
              <div className="terminal-helper">[VALIDATING...] Checking SVG compatibility</div>
            )}
          </div>
        )}
      </div>
      {fileError && <div className="terminal-error">[ERROR] {fileError}</div>}
      {error && !fileError && <div className="terminal-error">[ERROR] {error}</div>}
      {value && renderValid && !fileError && (
        <div className="terminal-success">[OK] SVG validated and ready</div>
      )}
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