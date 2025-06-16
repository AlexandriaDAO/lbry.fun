import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";

interface BalanceCardProps {
  title: string;
  balance: string;
  symbol: string;
  usdValue?: string;
  logoBase64?: string;
  loading?: boolean;
  onRefresh?: () => void;
  children?: React.ReactNode;
  className?: string;
}

const BalanceCard: React.FC<BalanceCardProps> = ({
  title,
  balance,
  symbol,
  usdValue,
  logoBase64,
  loading = false,
  onRefresh,
  children,
  className = ""
}) => {
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      toast.info("Refreshing balance!");
    }
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (isNaN(num)) return "0.00";
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 8 
    });
  };

  return (
    <div className={`bg-primary py-5 px-7 me-3 rounded-3xl mb-5 w-full ${className}`}>
      <div className='flex justify-between items-center mb-3'>
        <div>
          <h4 className='text-2xl font-medium text-primary-foreground'>{symbol}</h4>
          <p className='text-sm text-primary-foreground/70'>{title}</p>
        </div>
        <div className='flex items-center gap-3'>
          {logoBase64 && (
            <img 
              src={`data:image/png;base64,${logoBase64}`} 
              alt={`${symbol} logo`}
              className="w-8 h-8 rounded-full"
            />
          )}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={loading}
              className='text-primary-foreground hover:text-primary-foreground/80 disabled:opacity-50'
            >
              <FontAwesomeIcon 
                icon={faRotate} 
                className={loading ? 'animate-spin' : ''} 
              />
            </button>
          )}
        </div>
      </div>
      
      <div className='mb-3'>
        <p className='text-3xl font-bold text-primary-foreground'>
          {formatBalance(balance)}
        </p>
        {usdValue && (
          <p className='text-sm text-primary-foreground/70'>
            ≈ ${formatBalance(usdValue)} USD
          </p>
        )}
      </div>
      
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default BalanceCard;