import React, { useEffect, useState } from "react";

import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { _SERVICE as _SERVICESWAP } from "../../../../../../declarations/icp_swap/icp_swap.did";
import { _SERVICE as _SERVICEICPLEDGER } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import AccessGuard from "../AccessGuard";
import { useAccessState } from "../../hooks/useAccessState";
import { TerminalProgressBar, TerminalBoxHeader } from "../terminals/TerminalUtils";

import { Link } from "react-router";
import swapSecondary from "../../thunks/swapSecondary";
import { flagHandler } from "../../swapSlice";
import { LoaderCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { icp_fee, minimum_icp } from "@/utils/utils";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";
import SuccessModal from "../successModal";
import LoadingModal from "../loadingModal";
import ErrorModal from "../errorModal";
import { TerminalAuthMenu } from "@/features/auth/components/TerminalAuthMenu";
import { RootState } from "@/store";
import SwapContentSkeleton from "./swapContentSkeleton";
import fetchTransactionHistory from "../../thunks/fetchTransactionHistory.thunk";
import getArchivedBal from "../../thunks/getArchivedBal";
import redeemArchivedBalance from "../../thunks/redeemArchivedBalance";


const SwapContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  const icpLedger = useAppSelector((state: RootState) => state.icpLedger);
  const swap = useAppSelector((state: RootState) => state.swap);
  const { accessState, countdown, launchTime, isTokenLive } = useAccessState();
  const [amount, setAmount] = useState("");
  const [secondaryRatio, setSecondaryRatio] = useState(0.0);
  const [tentativeSecondary, setTentativeSecondary] = useState(Number);
  const [loadingModalV, setLoadingModalV] = useState(false);
  const [successModalV, setSucessModalV] = useState(false);
  const [errorModalV, setErrorModalV] = useState({ flag: false, title: "", message: "" });

  const [inputState, setInputState] = useState<'default' | 'error' | 'focus'>('default');
  const [showRedeemSection, setShowRedeemSection] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);

  const handleSubmit = () => {
    if (!isAuthenticated || !principal || !swap.activeSwapPool?.[1].icp_swap_canister_id) return;
    
    // Check if token is live
    if (!isTokenLive) {
      setErrorModalV({ 
        flag: true, 
        title: "Trading Not Yet Available", 
        message: "This token is still in its launch period. Trading will be enabled after the 24-hour launch window." 
      });
      return;
    }
    
    let amountAfterFees = (Number(amount)).toFixed(4);
    dispatch(swapSecondary({ amount: amountAfterFees, userPrincipal: principal, canisterId: swap.activeSwapPool?.[1].icp_swap_canister_id }));
    setLoadingModalV(true);
  };

  const handleMaxIcp = () => {
    const userBal = Math.max(
      0,
      Number(icpLedger.accountBalance) - 2 * icp_fee
    ).toFixed(4);
    setAmount(userBal);
    setTentativeSecondary(secondaryRatio * Number(userBal));

  };
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {


    if (Number(e.target.value) >= 0) {
      setAmount(e.target.value);
      setTentativeSecondary(secondaryRatio * Number(e.target.value));
      setInputState('focus');
    }
  };
  useEffect(() => {
    setSecondaryRatio(Number(swap.secondaryRatio));
    setTentativeSecondary(
      parseFloat((Number(swap.secondaryRatio) * Number(amount)).toFixed(4))
    );
  }, [swap.secondaryRatio]);
  useEffect(() => {
    if (!isAuthenticated || !principal || !swap.activeSwapPool?.[1].secondary_token_id) return;
    if (swap.swapSuccess === true) {
      dispatch(getSecondaryBalance(principal));
      // Refresh transaction history after successful swap
      dispatch(fetchTransactionHistory({ userPrincipal: principal, startIndex: 0 }));
      dispatch(flagHandler());
      setLoadingModalV(false);
      setSucessModalV(true);
      setAmount("");
      setTentativeSecondary(0);
    }
  }, [isAuthenticated, principal, swap.swapSuccess, swap.activeSwapPool, dispatch]);
  useEffect(() => {
    if (swap.error) {
      setLoadingModalV(false);
      setErrorModalV({ flag: true, title: swap.error.title, message: swap.error.message });
      dispatch(flagHandler());

    }
  }, [swap])
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
    dispatch(getArchivedBal(principal));
  }, [isAuthenticated, principal, dispatch]);

  // Handle redeem functionality
  const handleRedeem = () => {
    setRedeemLoading(true);
    dispatch(redeemArchivedBalance());
  };

  useEffect(() => {
    if (swap.redeeemSuccess === true) {
      if (isAuthenticated && principal) dispatch(getArchivedBal(principal));
      dispatch(flagHandler());
      setRedeemLoading(false);
      setSucessModalV(true);
    }
  }, [swap.redeeemSuccess, isAuthenticated, principal, dispatch]);

  // Show skeleton while critical data is loading
  if (!swap.activeSwapPool || swap.secondaryRatio === null || swap.secondaryRatio === undefined) {
    return <SwapContentSkeleton />;
  }

  return (
    <AccessGuard accessState={accessState} countdown={countdown} launchTime={launchTime}>
      <div className="terminal-pure">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column - Swap Form */}
          <div>
            {/* Input Section */}
            <div className="mb-3">
              
              <div className={`bg-black border ${inputState === 'error' ? 'border-red-500' : inputState === 'focus' ? 'border-lime-500' : 'border-white/30'} p-3 mb-2`}>
                <div className="flex justify-between items-center">
                  <span className="terminal-label">icp_amount:</span>
                  <input
                    className="bg-transparent text-white font-mono text-sm text-right focus:outline-none w-full ml-4 caret-lime-500"
                    type="text"
                    value={amount}
                    min="0"
                    onChange={handleAmountChange}
                    placeholder="0.0000"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center mb-2">
                <span className="terminal-label">balance:</span>
                <span className="terminal-value">{icpLedger.accountBalance} icp</span>
              </div>
              
              <button
                className="bg-black border border-white/30 text-white font-mono text-xs px-3 py-1 hover:bg-white/10 transition-colors"
                onClick={handleMaxIcp}
              >
                [max]
              </button>
            </div>

            {/* Output Section */}
            <div className="mb-4">
              <div className="bg-black border border-white/30 p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="terminal-label">receive:</span>
                  <span className="terminal-primary">{tentativeSecondary.toFixed(4)} {swap.activeSwapPool?.[1].secondary_token_symbol}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="terminal-label">balance:</span>
                  <span className="terminal-value">{swap.secondaryBalance} {swap.activeSwapPool?.[1].secondary_token_symbol}</span>
                </div>
              </div>
            </div>

            {/* Status Messages */}
            {parseFloat(amount) < minimum_icp && amount !== "" && (
              <div className="mb-4">
                <div className="bg-black border border-pink-500/50 p-3">
                  <span className="terminal-status">[error]</span> minimum_amount: {minimum_icp} icp
                </div>
              </div>
            )}

            {/* Action Section */}
            <div>
              {isAuthenticated ? (
                <button
                  type="button"
                  className={`w-full font-mono text-sm px-4 py-3 transition-colors ${
                    parseFloat(amount) === 0 || amount === "" || parseFloat(amount) < minimum_icp || swap.loading || !isTokenLive 
                      ? 'bg-black border border-white/30 text-white opacity-50 cursor-not-allowed' 
                      : 'bg-lime-500 text-black font-bold hover:bg-lime-400 cursor-pointer'
                  }`}
                  disabled={parseFloat(amount) === 0 || swap.loading || parseFloat(amount) < minimum_icp || amount === "" || !isTokenLive}
                  onClick={handleSubmit}
                  title={!isTokenLive ? "Trading will be enabled after the launch period" : ""}
                >
                  {swap.loading ? (
                    <LoaderCircle size={14} className="animate-spin mx-auto" />
                  ) : !isTokenLive ? (
                    <span className="terminal-status">[awaiting_launch]</span>
                  ) : (
                    <span>execute_swap</span>
                  )}
                </button>
              ) : (
                <div className="bg-black border border-white/30 text-white font-mono text-sm px-4 py-3 flex items-center justify-center">
                  <TerminalAuthMenu />
                </div>
              )}
              
              <div className="mt-3">
                <span className="terminal-label">* failed transactions can be redeemed below</span>
              </div>
            </div>
          </div>

          {/* Right Column - Transaction Details */}
          <div>
            <div className="bg-black border border-white/30 p-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="terminal-label">network_fee:</span>
                  <span className="terminal-value">{icp_fee} icp</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="terminal-label">send:</span>
                  <span className="terminal-value">{amount || "0"} icp</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="terminal-label">receive:</span>
                  <span className="terminal-primary">{tentativeSecondary.toFixed(4)} {swap.activeSwapPool?.[1].secondary_token_symbol}</span>
                </div>
                
                <div className="border-t border-white/30 mt-3 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="terminal-label">exchange_rate:</span>
                    <span className="terminal-value">1 icp = {secondaryRatio} {swap.activeSwapPool?.[1].secondary_token_symbol}</span>
                  </div>
                </div>
                
                <div className="border-t border-white/30 mt-3 pt-3">
                  <span className="terminal-label">* swaps are irreversible</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Redeem Section */}
        {isAuthenticated && swap.archivedBalance && Number(swap.archivedBalance) > 0 && (
          <div className="border-t border-white/30 mt-6 pt-4">
            <button
              onClick={() => setShowRedeemSection(!showRedeemSection)}
              className="bg-black border border-white/30 text-white font-mono text-xs px-3 py-2 hover:bg-white/10 transition-colors mb-3"
            >
              <span className="terminal-prompt">▶</span> archived_balance: {swap.archivedBalance} icp {showRedeemSection ? '[-]' : '[+]'}
            </button>

            {showRedeemSection && (
              <div className="bg-black border border-white/30 p-3 mt-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="terminal-label">recoverable:</span>
                  <span className="terminal-primary">{swap.archivedBalance} icp</span>
                </div>
                
                <button
                  onClick={handleRedeem}
                  disabled={redeemLoading || swap.loading}
                  className={`w-full font-mono text-sm px-4 py-2 transition-colors ${
                    redeemLoading || swap.loading 
                      ? 'bg-black border border-white/30 text-white opacity-50 cursor-not-allowed' 
                      : 'bg-lime-500 text-black font-bold hover:bg-lime-400 cursor-pointer'
                  }`}
                >
                  {redeemLoading ? (
                    <LoaderCircle size={14} className="animate-spin mx-auto" />
                  ) : (
                    'execute_redeem'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        <LoadingModal show={loadingModalV} message1={"Swap in Progress"} message2={`Your transaction from ICP to  ${swap.activeSwapPool?.[1].secondary_token_symbol}  is being processed. This may take a few moments`} setShow={setLoadingModalV} />
        <SuccessModal show={successModalV} setShow={setSucessModalV} />
        <ErrorModal show={errorModalV.flag} setShow={setErrorModalV} title={errorModalV.title} message={errorModalV.message} />
      </div>
    </AccessGuard>
  );
};
export default SwapContent;