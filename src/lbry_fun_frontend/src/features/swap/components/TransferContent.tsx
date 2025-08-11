import React, { useState, useCallback } from "react";
import { Principal } from "@dfinity/principal";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { RootState } from "@/store";
import { tradingThunks } from "../thunks/tradingThunks";
import { balanceThunks } from "../thunks/balanceThunks";
import { analyticsThunks } from "../thunks/analyticsThunks";
import transferICP from "@/features/icp-ledger/thunks/transferICP";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";

// Destructure for easier access
const { transferPrimary, transferSecondary } = tradingThunks;
const { getPrimaryBalance, getSecondaryBalance } = balanceThunks;
const { fetchTransactionHistory } = analyticsThunks;
import { LoaderCircle } from "lucide-react";
import TerminalNotification from "./TerminalNotification";
import { useTerminalNotification } from "../hooks/useTerminalNotification";
import CopyHelper from "./CopyHelper";
import QRCode from "react-qr-code";
import { icp_fee } from "@/utils/utils";

const TransferContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState("send");
  
  // Redux state
  const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  const icpLedger = useAppSelector((state: RootState) => state.icpLedger);
  const primary = useAppSelector((state: RootState) => state.primary);
  const swap = useAppSelector((state: RootState) => state.swap);
  const transferPrimaryStatus = useAppSelector((state: RootState) => state.swap.operations.transferPrimary);
  const transferSecondaryStatus = useAppSelector((state: RootState) => state.swap.operations.transferSecondary);
  const transferIcpStatus = useAppSelector((state: RootState) => state.swap.operations.transferIcp);
  
  // Send state
  const [destinationPrincipal, setDestinationPrincipal] = useState("");
  const [principalError, setPrincipalError] = useState("");
  const [amount, setAmount] = useState("0");
  const [selectedToken, setSelectedToken] = useState("ICP");
  const { notification, showLoading, showSuccess, showError, hide } = useTerminalNotification();

  const validatePrincipal = useCallback((principalString: string): boolean => {
    try {
      if (!principalString) {
        setPrincipalError("Principal ID is required");
        return false;
      }
      Principal.fromText(principalString);
      setPrincipalError("");
      return true;
    } catch (error) {
      setPrincipalError("Invalid Principal ID format");
      return false;
    }
  }, []);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (Number(e.target.value) >= 0) {
      setAmount(e.target.value);
    }
  }, []);

  const handleTokenChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedToken(e.target.value);
  }, []);

  const handlePrincipalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDestinationPrincipal(e.target.value);
    validatePrincipal(e.target.value);
  }, [validatePrincipal]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handleSend = useCallback(() => {
    if (!validatePrincipal(destinationPrincipal)) return;
    if (!amount || Number(amount) <= 0) {
      setPrincipalError("Amount must be greater than 0");
      return;
    }

    showLoading("TRANSFER IN PROGRESS", "PROCESSING TRANSACTION...");

    if (selectedToken === "ICP") {
      dispatch(transferICP({ to: destinationPrincipal, amount }));
    } else if (selectedToken === swap.activeSwapPool?.[1]?.primary_token_symbol) {
      dispatch(transferPrimary({ destination: destinationPrincipal, amount }));
    } else if (selectedToken === swap.activeSwapPool?.[1]?.secondary_token_symbol) {
      dispatch(transferSecondary({ to: destinationPrincipal, amount }));
    }
  }, [validatePrincipal, destinationPrincipal, amount, selectedToken, swap.activeSwapPool, dispatch, showLoading]);

  // Handle transfer operation state changes
  React.useEffect(() => {
    const isTransferPending = transferPrimaryStatus === 'pending' || transferSecondaryStatus === 'pending' || transferIcpStatus === 'pending';
    const transferSuccess = transferPrimaryStatus === 'success' || transferSecondaryStatus === 'success' || transferIcpStatus === 'success';
    const transferError = transferPrimaryStatus === 'error' || transferSecondaryStatus === 'error' || transferIcpStatus === 'error';
    
    if (transferSuccess) {
      hide();
      showSuccess("SUCCESS", "TRANSACTION SUBMITTED");
      setAmount("0");
      setDestinationPrincipal("");
      
      // Refresh balances after successful transfer
      if (principal) {
        dispatch(getIcpBal(principal));
        if (swap.activeSwapPool) {
          dispatch(getPrimaryBalance(principal));
          dispatch(getSecondaryBalance(principal));
          dispatch(fetchTransactionHistory({ 
            userPrincipal: principal,
            startIndex: 0
          }));
        }
      }
    } else if (transferError) {
      hide();
      showError("ERROR", "TRANSACTION FAILED → TRY AGAIN");
    }
  }, [transferPrimaryStatus, transferSecondaryStatus, transferIcpStatus, dispatch, hide, showSuccess, showError, principal, swap.activeSwapPool]);

  const getBalance = () => {
    switch (selectedToken) {
      case "ICP":
        return icpLedger.accountBalance || "0";
      case swap.activeSwapPool?.[1]?.primary_token_symbol:
        return primary.primaryBal || "0";
      case swap.activeSwapPool?.[1]?.secondary_token_symbol:
        return swap.secondaryBalance || "0";
      default:
        return "0";
    }
  };

  const getFee = () => {
    switch (selectedToken) {
      case "ICP":
        return icp_fee;
      case swap.activeSwapPool?.[1]?.primary_token_symbol:
        return primary.primaryFee || "0";
      case swap.activeSwapPool?.[1]?.secondary_token_symbol:
        return swap.secondaryFee || "0";
      default:
        return "0";
    }
  };

  const renderSendTab = () => (
    <div className="space-y-4">
      <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
        <label className="text-gray-400 text-xs text-xs mb-2 block">SELECT TOKEN</label>
        <select 
          value={selectedToken} 
          onChange={handleTokenChange}
          className="bg-transparent border border-white/20 text-white font-mono text-sm w-full p-2 rounded focus:outline-none focus:border-lime-500"
        >
          <option value="ICP" className="bg-black">ICP</option>
          {swap.activeSwapPool && (
            <>
              <option value={swap.activeSwapPool[1].primary_token_symbol} className="bg-black">
                {swap.activeSwapPool[1].primary_token_symbol}
              </option>
              <option value={swap.activeSwapPool[1].secondary_token_symbol} className="bg-black">
                {swap.activeSwapPool[1].secondary_token_symbol}
              </option>
            </>
          )}
        </select>
      </div>

      <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
        <label className="text-gray-400 text-xs text-xs mb-2 block">RECIPIENT PRINCIPAL</label>
        <input
          type="text"
          value={destinationPrincipal}
          onChange={handlePrincipalChange}
          placeholder="Enter principal ID"
          className="bg-transparent text-white font-mono text-sm w-full focus:outline-none"
        />
        {principalError && (
          <div className="text-red-400 text-xs mt-2">{principalError}</div>
        )}
      </div>

      <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
        <label className="text-gray-400 text-xs text-xs mb-2 block">AMOUNT</label>
        <input
          type="number"
          value={amount}
          onChange={handleAmountChange}
          placeholder="0"
          className="bg-transparent text-white font-mono text-lg w-full focus:outline-none mb-3"
        />
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-xs text-xs">Balance:</span>
            <span className="text-white text-sm text-xs">{getBalance()} {selectedToken}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-xs text-xs">Fee:</span>
            <span className="text-white text-sm text-xs">{getFee()} {selectedToken}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSend}
        disabled={!isAuthenticated || !amount || Number(amount) <= 0 || !!principalError || transferPrimaryStatus === 'pending' || transferSecondaryStatus === 'pending' || transferIcpStatus === 'pending'}
        className={`w-full font-mono text-sm px-4 py-3 rounded transition-all ${
          !isAuthenticated || !amount || Number(amount) <= 0 || !!principalError || transferPrimaryStatus === 'pending' || transferSecondaryStatus === 'pending' || transferIcpStatus === 'pending'
            ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
            : 'bg-lime-500 text-black font-bold hover:bg-lime-400 cursor-pointer'
        }`}
      >
        {!isAuthenticated ? 'CONNECT WALLET' : 
         (transferPrimaryStatus === 'pending' || transferSecondaryStatus === 'pending' || transferIcpStatus === 'pending') ? (
          <LoaderCircle size={14} className="animate-spin mx-auto" />
        ) : 'SEND TOKENS'}
      </button>
    </div>
  );

  const renderReceiveTab = () => (
    <div className="space-y-4">
      <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
        <label className="text-gray-400 text-xs text-xs mb-2 block">YOUR PRINCIPAL ID</label>
        <div className="break-all text-sm font-mono text-white mb-3">
          {principal || "Not connected"}
        </div>
        {principal && <CopyHelper text={principal} />}
      </div>

      {principal && (
        <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
          <label className="text-gray-400 text-xs text-xs mb-3 block">QR CODE</label>
          <div className="flex justify-center p-4 bg-white rounded">
            <QRCode value={principal} size={180} />
          </div>
        </div>
      )}

      <div className="border border-white/20 bg-background-secondary p-4 rounded-lg">
        <label className="text-gray-400 text-xs text-xs mb-3 block">SUPPORTED TOKENS</label>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">ICP</span>
            <span className="text-lime-500 text-xs">ACTIVE</span>
          </div>
          {swap.activeSwapPool && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm">{swap.activeSwapPool[1].primary_token_symbol}</span>
                <span className="text-lime-500 text-xs">ACTIVE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">{swap.activeSwapPool[1].secondary_token_symbol}</span>
                <span className="text-lime-500 text-xs">ACTIVE</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="w-full">
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => handleTabChange("send")}
            className={`text-xs px-3 py-1 transition-all ${
              activeTab === "send" 
                ? "bg-lime-500 text-black font-bold" 
                : "bg-transparent text-gray-400 hover:text-white"
            }`}
          >
            SEND
          </button>
          <button
            onClick={() => handleTabChange("receive")}
            className={`text-xs px-3 py-1 transition-all ${
              activeTab === "receive" 
                ? "bg-lime-500 text-black font-bold" 
                : "bg-transparent text-gray-400 hover:text-white"
            }`}
          >
            RECEIVE
          </button>
        </div>
        
        <div className="mt-4">
          {activeTab === "send" ? renderSendTab() : renderReceiveTab()}
        </div>
      </div>

      {/* Notifications */}
      <TerminalNotification 
        type={notification.type}
        isOpen={notification.isOpen}
        onClose={hide}
        title={notification.title}
        message={notification.message}
      />
    </>
  );
};

export default TransferContent;