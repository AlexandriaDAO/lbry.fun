import React, { useState } from 'react';
import { useBalance } from '../hooks/useBalance';
import { useActivePool } from '../hooks/useSwapState';
import { TokenDisplay, RefreshButton, StatusIndicator } from './';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/lib/components/ui/popover";
import { Button } from "@/lib/components/ui/button";
import { ChevronDown, Wallet } from "lucide-react";

const HeaderBalance: React.FC = () => {
  const { balances, loading, refreshBalances, isAuthenticated } = useBalance();
  const activePool = useActivePool();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isAuthenticated) {
    return null;
  }

  const primaryLogoBase64 = activePool?.[1]?.primary_token_logo_base64;
  const secondaryLogoBase64 = activePool?.[1]?.secondary_token_logo_base64;
  const primarySymbol = activePool?.[1]?.primary_token_symbol || 'PRIMARY';
  const secondarySymbol = activePool?.[1]?.secondary_token_symbol || 'SECONDARY';

  // Calculate total USD value
  const primaryUsdValue = parseFloat(balances.primary.priceUsd) * parseFloat(balances.primary.balance);
  const totalUsdValue = primaryUsdValue.toFixed(2);

  return (
    <Popover open={isExpanded} onOpenChange={setIsExpanded}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 px-3 py-2 h-auto"
        >
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            
            {/* Compact primary balance display */}
            <div className="hidden sm:flex items-center gap-1">
              {primaryLogoBase64 && (
                <img 
                  src={`data:image/png;base64,${primaryLogoBase64}`} 
                  alt={`${primarySymbol} logo`}
                  className="w-5 h-5 rounded-full"
                />
              )}
              <span className="font-semibold text-sm">
                {parseFloat(balances.primary.balance).toLocaleString(undefined, { 
                  minimumFractionDigits: 0, 
                  maximumFractionDigits: 2 
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {primarySymbol}
              </span>
            </div>

            {/* USD value */}
            <div className="hidden lg:block">
              <span className="text-xs text-muted-foreground">
                ${totalUsdValue}
              </span>
            </div>

            {/* Loading indicator */}
            {loading && (
              <StatusIndicator status="loading" size="sm" showText={false} />
            )}
          </div>
          
          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          {/* Header with refresh */}
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Token Balances</h4>
            <RefreshButton 
              onRefresh={refreshBalances}
              loading={loading}
              size="sm"
              toastMessage="Refreshing balances..."
            />
          </div>
          
          {/* Primary balance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <TokenDisplay
                symbol={primarySymbol}
                amount={balances.primary.balance}
                logoBase64={primaryLogoBase64}
                usdValue={primaryUsdValue.toString()}
                size="sm"
              />
            </div>
            
            {/* Secondary balance */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <TokenDisplay
                symbol={secondarySymbol}
                amount={balances.secondary.balance}
                logoBase64={secondaryLogoBase64}
                size="sm"
                showUsd={false}
              />
            </div>
            
            {/* Archived ICP balance if any */}
            {parseFloat(balances.icp.archivedBalance) > 0 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-orange-800">
                    Archived ICP: {balances.icp.archivedBalance}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Quick actions */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Quick Actions</p>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setIsExpanded(false);
                  // Navigate to balance page
                  window.location.hash = '#/swap/balance';
                }}
              >
                View All
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setIsExpanded(false);
                  // Navigate to swap page
                  window.location.hash = '#/swap/trade';
                }}
              >
                Swap
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default HeaderBalance;