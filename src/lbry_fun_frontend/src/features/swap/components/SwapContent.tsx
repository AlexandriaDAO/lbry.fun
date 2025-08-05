import React, { useEffect, useState, useCallback } from "react";

import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { _SERVICE as _SERVICESWAP } from "../../../../../../declarations/icp_swap/icp_swap.did";
import { _SERVICE as _SERVICEICPLEDGER } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import AccessGuard from "./AccessGuard";
import { useAccessState } from "../hooks/useAccessState";
import { TerminalProgressBar, TerminalBoxHeader } from "../terminals/TerminalUtils";

import { Link } from "react-router";
import { tradingThunks } from "../thunks/tradingThunks";
import { balanceThunks } from "../thunks/balanceThunks";
import { analyticsThunks } from "../thunks/analyticsThunks";
import { resetOperation } from "../store/swapSlice";
import { LoaderCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { icp_fee, minimum_icp } from "@/utils/utils";
import TerminalNotification from "./TerminalNotification";
import { useTerminalNotification } from "../hooks/useTerminalNotification";
import { TerminalAuthMenu } from "@/features/auth/components/TerminalAuthMenu";
import { RootState } from "@/store";
import UnifiedSkeleton from "./UnifiedSkeleton";

// Destructure for easier access
const { swapSecondary } = tradingThunks;
const { getSecondaryBalance, getArchivedBalance, redeemArchivedBalance } = balanceThunks;
const { fetchTransactionHistory } = analyticsThunks;


const SwapContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  const icpLedger = useAppSelector((state: RootState) => state.icpLedger);
  const swap = useAppSelector((state: RootState) => state.swap);
  const swapStatus = useAppSelector((state: RootState) => state.swap.operations.swap);
  const swapError = useAppSelector((state: RootState) => state.swap.operationErrors.swap);
  const redeemStatus = useAppSelector((state: RootState) => state.swap.operations.redeem);
  const redeemError = useAppSelector((state: RootState) => state.swap.operationErrors.redeem);
  const { accessState, countdown, launchTime, isTokenLive } = useAccessState();
  const [amount, setAmount] = useState("");
  const [secondaryRatio, setSecondaryRatio] = useState(0.0);
  const [tentativeSecondary, setTentativeSecondary] = useState(Number);
  const { notification, showLoading, showSuccess, showError, hide } = useTerminalNotification();

  const [inputState, setInputState] = useState<'default' | 'error' | 'focus'>('default');
  const [showRedeemSection, setShowRedeemSection] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);

  const handleSubmit = useCallback(() => {
    if (!isAuthenticated || !principal || !swap.activeSwapPool?.[1].icp_swap_canister_id) return;
    
    // Check if token is live
    if (!isTokenLive) {
      showError(
        "TRADING LOCKED", 
        "Token in launch period. Trading enabled after 24h."
      );
      return;
    }
    
    let amountAfterFees = (Number(amount)).toFixed(4);
    dispatch(swapSecondary({ amount: amountAfterFees, userPrincipal: principal, canisterId: swap.activeSwapPool?.[1].icp_swap_canister_id }));
    showLoading(
      "SWAP IN PROGRESS",
      `Processing ICP → ${swap.activeSwapPool?.[1].secondary_token_symbol}`
    );
  }, [isAuthenticated, principal, swap.activeSwapPool, isTokenLive, amount, dispatch, showError, showLoading]);

  const handleMaxIcp = useCallback(() => {
    const userBal = Math.max(
      0,
      Number(icpLedger.accountBalance) - 2 * icp_fee
    ).toFixed(4);
    setAmount(userBal);
    setTentativeSecondary(secondaryRatio * Number(userBal));
  }, [icpLedger.accountBalance, secondaryRatio]);
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (Number(e.target.value) >= 0) {
      setAmount(e.target.value);
      setTentativeSecondary(secondaryRatio * Number(e.target.value));
      setInputState('focus');
    }
  }, [secondaryRatio]);
  useEffect(() => {
    const ratio = Number(swap.secondaryRatio) || 0;
    setSecondaryRatio(ratio);
    setTentativeSecondary(
      parseFloat((ratio * Number(amount)).toFixed(4))
    );
  }, [swap.secondaryRatio, amount]);
  // Handle swap operation state changes
  useEffect(() => {
    if (swapStatus === 'pending') {
      // Loading state is already shown from handleSubmit
    } else if (swapStatus === 'success') {
      hide();
      showSuccess("SUCCESS", "Transaction submitted");
      setAmount("");
      setTentativeSecondary(0);
      
      // Refresh balances after successful swap
      if (isAuthenticated && principal) {
        dispatch(getSecondaryBalance(principal));
        dispatch(fetchTransactionHistory({ userPrincipal: principal, startIndex: 0 }));
      }
      
      // Auto-reset is handled by middleware after 3 seconds
    } else if (swapStatus === 'error' && swapError) {
      hide();
      showError(swapError.title, swapError.message);
      dispatch(resetOperation('swap'));
    }
  }, [swapStatus, swapError, dispatch, hide, showSuccess, showError, isAuthenticated, principal, swap.activeSwapPool])
  useEffect(() => {
    if (amount == "0" || Number(amount) < minimum_icp) {
      setInputState('error');
    } else if (amount == "") {
      setInputState('default');
    } else {
      setInputState('focus');
    }
  }, [amount])

  // Fetch archived balance when authenticated
  useEffect(() => {
    if (!isAuthenticated || !principal) return;
    dispatch(getArchivedBalance(principal));
  }, [isAuthenticated, principal, dispatch]);

  // Handle redeem functionality
  const handleRedeem = useCallback(() => {
    setRedeemLoading(true);
    dispatch(redeemArchivedBalance());
  }, [dispatch]);

  // Handle redeem section toggle
  const handleToggleRedeemSection = useCallback(() => {
    setShowRedeemSection(prev => !prev);
  }, []);

  // Handle redeem operation state changes
  useEffect(() => {
    if (redeemStatus === 'pending') {
      setRedeemLoading(true);
    } else if (redeemStatus === 'success') {
      setRedeemLoading(false);
      showSuccess("Success!", "Transaction Submitted!");
      if (isAuthenticated && principal) {
        dispatch(getArchivedBalance(principal));
      }
    } else if (redeemStatus === 'error' && redeemError) {
      setRedeemLoading(false);
      showError(redeemError.title, redeemError.message);
      dispatch(resetOperation('redeem'));
    }
  }, [redeemStatus, redeemError, dispatch, showSuccess, showError, isAuthenticated, principal]);

  // Show skeleton while critical data is loading
  if (!swap.activeSwapPool || swap.secondaryRatio === null || swap.secondaryRatio === undefined) {
    return <UnifiedSkeleton variant="swap" />;
  }

  return (
    <AccessGuard accessState={accessState} countdown={countdown} launchTime={launchTime}>
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Swap Form */}
          <div>
            {/* Input Section */}
            <div className="space-y-3 mb-6">
              <div className={`border ${inputState === 'error' ? 'border-red-500' : inputState === 'focus' ? 'border-lime-500' : 'border-white/20'} bg-background-secondary p-4 rounded-lg transition-colors`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="terminal-label text-xs">SEND ICP</span>
                  <button
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                    onClick={handleMaxIcp}
                  >
                    MAX
                  </button>
                </div>
                <input
                  className="bg-transparent text-white font-mono text-lg w-full focus:outline-none caret-lime-500"
                  type="text"
                  value={amount}
                  min="0"
                  onChange={handleAmountChange}
                  placeholder="0.0000"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="terminal-label text-xs">balance:</span>
                  <span className="terminal-value text-xs">{icpLedger.accountBalance} ICP</span>
                </div>
              </div>

              {/* Output Section */}
              <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="terminal-label text-xs">RECEIVE {swap.activeSwapPool?.[1].secondary_token_symbol}</span>
                </div>
                <div className="text-lime-500 font-mono text-lg mb-2">
                  {(tentativeSecondary || 0).toFixed(4)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="terminal-label text-xs">balance:</span>
                  <span className="terminal-value text-xs">{swap.secondaryBalance} {swap.activeSwapPool?.[1].secondary_token_symbol}</span>
                </div>
              </div>
            </div>

            {/* Status Messages */}
            {parseFloat(amount) < minimum_icp && amount !== "" && (
              <div className="mb-4 p-3 border border-red-500/50 bg-red-500/10 rounded text-sm">
                <span className="text-red-400">Minimum amount: {minimum_icp} ICP</span>
              </div>
            )}

            {/* Action Section */}
            <div>
              {isAuthenticated ? (
                <button
                  type="button"
                  className={`w-full font-mono text-sm px-4 py-3 rounded transition-all ${
                    parseFloat(amount) === 0 || amount === "" || parseFloat(amount) < minimum_icp || swapStatus === 'pending' || !isTokenLive 
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed' 
                      : 'bg-lime-500 text-black font-bold hover:bg-lime-400 cursor-pointer'
                  }`}
                  disabled={parseFloat(amount) === 0 || swapStatus === 'pending' || parseFloat(amount) < minimum_icp || amount === "" || !isTokenLive}
                  onClick={handleSubmit}
                  title={!isTokenLive ? "Trading will be enabled after the launch period" : ""}
                >
                  {swapStatus === 'pending' ? (
                    <LoaderCircle size={14} className="animate-spin mx-auto" />
                  ) : !isTokenLive ? (
                    <span>AWAITING LAUNCH</span>
                  ) : (
                    <span>EXECUTE SWAP</span>
                  )}
                </button>
              ) : (
                <div className="bg-gray-800 text-white font-mono text-sm px-4 py-3 rounded flex items-center justify-center">
                  <TerminalAuthMenu />
                </div>
              )}
              
              <div className="mt-3">
                <span className="text-xs text-gray-400">* Failed transactions can be redeemed below</span>
              </div>
            </div>
          </div>

          {/* Right Column - Transaction Details */}
          <div>
            <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
              <h3 className="text-sm font-semibold mb-4">Transaction Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="terminal-label text-xs">Network Fee:</span>
                  <span className="terminal-value text-xs">{icp_fee} ICP</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="terminal-label text-xs">Send:</span>
                  <span className="terminal-value text-xs">{amount || "0"} ICP</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="terminal-label text-xs">Receive:</span>
                  <span className="terminal-primary text-xs">{(tentativeSecondary || 0).toFixed(4)} {swap.activeSwapPool?.[1].secondary_token_symbol}</span>
                </div>
                
                <div className="border-t border-white/10 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="terminal-label text-xs">Exchange Rate:</span>
                    <span className="terminal-value text-xs">1 ICP = {secondaryRatio.toFixed(4)} {swap.activeSwapPool?.[1].secondary_token_symbol}</span>
                  </div>
                </div>
                
                <div className="pt-3">
                  <span className="text-xs text-gray-400">* Swaps are irreversible</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Redeem Section */}
        {isAuthenticated && swap.archivedBalance && Number(swap.archivedBalance) > 0 && (
          <div className="mt-6 border-t border-white/10 pt-6">
            <button
              onClick={handleToggleRedeemSection}
              className="text-sm text-gray-400 hover:text-white transition-colors mb-3 flex items-center gap-2"
            >
              <span className="text-xs">{showRedeemSection ? '▼' : '▶'}</span>
              Archived Balance: {swap.archivedBalance} ICP
            </button>

            {showRedeemSection && (
              <div className="border border-white/20 bg-background-secondary p-4 rounded-lg mt-3">
                <div className="flex justify-between items-center mb-4">
                  <span className="terminal-label text-sm">Recoverable Amount:</span>
                  <span className="terminal-primary text-sm">{swap.archivedBalance} ICP</span>
                </div>
                
                <button
                  onClick={handleRedeem}
                  disabled={redeemStatus === 'pending'}
                  className={`w-full font-mono text-sm px-4 py-2 rounded transition-all ${
                    redeemStatus === 'pending' 
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed' 
                      : 'bg-lime-500 text-black font-bold hover:bg-lime-400 cursor-pointer'
                  }`}
                >
                  {redeemStatus === 'pending' ? (
                    <LoaderCircle size={14} className="animate-spin mx-auto" />
                  ) : (
                    'REDEEM FUNDS'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        <TerminalNotification
          type={notification.type}
          isOpen={notification.isOpen}
          onClose={hide}
          title={notification.title}
          message={notification.message}
        />
      </div>
    </AccessGuard>
  );
};
export default SwapContent;