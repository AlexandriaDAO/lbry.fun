import React from 'react';

interface TokenDisplayProps {
  symbol: string;
  amount: string;
  logoBase64?: string;
  usdValue?: string;
  size?: 'sm' | 'md' | 'lg';
  showUsd?: boolean;
  className?: string;
}

const TokenDisplay: React.FC<TokenDisplayProps> = ({
  symbol,
  amount,
  logoBase64,
  usdValue,
  size = 'md',
  showUsd = true,
  className = ""
}) => {
  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 8 
    });
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'gap-2',
          logo: 'w-6 h-6',
          amount: 'text-lg',
          symbol: 'text-sm',
          usd: 'text-xs'
        };
      case 'lg':
        return {
          container: 'gap-4',
          logo: 'w-12 h-12',
          amount: 'text-3xl',
          symbol: 'text-lg',
          usd: 'text-sm'
        };
      default: // md
        return {
          container: 'gap-3',
          logo: 'w-8 h-8',
          amount: 'text-2xl',
          symbol: 'text-base',
          usd: 'text-sm'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className={`flex items-center ${sizeClasses.container} ${className}`}>
      {logoBase64 && (
        <img 
          src={`data:image/png;base64,${logoBase64}`} 
          alt={`${symbol} logo`}
          className={`${sizeClasses.logo} rounded-full`}
        />
      )}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          <span className={`font-bold ${sizeClasses.amount}`}>
            {formatAmount(amount)}
          </span>
          <span className={`text-muted-foreground ${sizeClasses.symbol}`}>
            {symbol}
          </span>
        </div>
        {showUsd && usdValue && (
          <span className={`text-muted-foreground ${sizeClasses.usd}`}>
            ≈ ${formatAmount(usdValue)} USD
          </span>
        )}
      </div>
    </div>
  );
};

export default TokenDisplay;