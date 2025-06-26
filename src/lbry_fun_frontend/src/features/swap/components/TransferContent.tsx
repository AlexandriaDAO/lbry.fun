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
import Modal from "./Modal";
import { useModal } from "../hooks/useModal";
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
  
  // Send state
  const [destinationPrincipal, setDestinationPrincipal] = useState("");
  const [principalError, setPrincipalError] = useState("");
  const [amount, setAmount] = useState("0");
  const [selectedToken, setSelectedToken] = useState("ICP");
  const { modal, showLoading, showSuccess, showError, hide } = useModal();

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

  const handleSend = useCallback(async () => {
    if (!validatePrincipal(destinationPrincipal)) return;
    if (!amount || Number(amount) <= 0) {
      setPrincipalError("Amount must be greater than 0");
      return;
    }

    showLoading("Transfer in Progress", "Transaction is being processed. This may take a few moments.");

    try {
      if (selectedToken === "ICP") {
        await dispatch(transferICP({ to: destinationPrincipal, amount }));
      } else if (selectedToken === swap.activeSwapPool?.[1]?.primary_token_symbol) {
        await dispatch(transferPrimary({ to: destinationPrincipal, amount }));
      } else if (selectedToken === swap.activeSwapPool?.[1]?.secondary_token_symbol) {
        await dispatch(transferSecondary({ to: destinationPrincipal, amount }));
      }

      // Refresh balances
      await dispatch(getIcpBal(principal));
      if (swap.activeSwapPool) {
        await dispatch(getPrimaryBalance(principal));
        await dispatch(getSecondaryBalance(principal));
        await dispatch(fetchTransactionHistory({ 
          principal: Principal.fromText(principal),
          poolId: swap.activeSwapPool[0]
        }));
      }

      hide();
      showSuccess("Success!", "Transaction Submitted!");
      setAmount("0");
      setDestinationPrincipal("");
    } catch (error) {
      hide();
      showError("Something went wrong...", "Please try again or seek help if needed");
    }
  }, [validatePrincipal, destinationPrincipal, amount, selectedToken, swap.activeSwapPool, principal, dispatch, showLoading, hide, showSuccess, showError]);

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
    <div className="terminal-pure p-4">
      <div className="terminal-section mb-4">
        <div className="terminal-label mb-2">token:</div>
        <select 
          value={selectedToken} 
          onChange={handleTokenChange}
          className="terminal-select w-full"
        >
          <option value="ICP">ICP</option>
          {swap.activeSwapPool && (
            <>
              <option value={swap.activeSwapPool[1].primary_token_symbol}>
                {swap.activeSwapPool[1].primary_token_symbol}
              </option>
              <option value={swap.activeSwapPool[1].secondary_token_symbol}>
                {swap.activeSwapPool[1].secondary_token_symbol}
              </option>
            </>
          )}
        </select>
      </div>

      <div className="terminal-section mb-4">
        <div className="terminal-label mb-2">recipient_principal:</div>
        <input
          type="text"
          value={destinationPrincipal}
          onChange={handlePrincipalChange}
          placeholder="Enter principal ID"
          className="terminal-input w-full"
        />
        {principalError && (
          <div className="terminal-error mt-1">{principalError}</div>
        )}
      </div>

      <div className="terminal-section mb-4">
        <div className="terminal-label mb-2">amount:</div>
        <input
          type="number"
          value={amount}
          onChange={handleAmountChange}
          placeholder="0"
          className="terminal-input w-full"
        />
        <div className="terminal-row mt-2">
          <span className="terminal-label">balance:</span>
          <span className="terminal-value">{getBalance()} {selectedToken}</span>
        </div>
        <div className="terminal-row">
          <span className="terminal-label">fee:</span>
          <span className="terminal-value">{getFee()} {selectedToken}</span>
        </div>
      </div>

      <button
        onClick={handleSend}
        disabled={!isAuthenticated || !amount || Number(amount) <= 0 || !!principalError}
        className="terminal-button terminal-button-primary w-full"
      >
        {isAuthenticated ? 'SEND' : 'CONNECT WALLET'}
      </button>
    </div>
  );

  const renderReceiveTab = () => (
    <div className="terminal-pure p-4">
      <div className="terminal-section mb-4">
        <div className="terminal-label mb-2">your_principal_id:</div>
        <div className="terminal-info p-3">
          <div className="break-all mb-2 text-sm">{principal || "Not connected"}</div>
          {principal && <CopyHelper text={principal} />}
        </div>
      </div>

      {principal && (
        <div className="terminal-section">
          <div className="terminal-label mb-2">qr_code:</div>
          <div className="flex justify-center p-4 bg-white">
            <QRCode value={principal} size={200} />
          </div>
        </div>
      )}

      <div className="terminal-section mt-4">
        <div className="terminal-info">
          <div className="terminal-label mb-2">supported_tokens:</div>
          <div className="space-y-1">
            <div className="terminal-row">
              <span className="terminal-label">ICP:</span>
              <span className="terminal-status">[ACTIVE]</span>
            </div>
            {swap.activeSwapPool && (
              <>
                <div className="terminal-row">
                  <span className="terminal-label">{swap.activeSwapPool[1].primary_token_symbol}:</span>
                  <span className="terminal-status">[ACTIVE]</span>
                </div>
                <div className="terminal-row">
                  <span className="terminal-label">{swap.activeSwapPool[1].secondary_token_symbol}:</span>
                  <span className="terminal-status">[ACTIVE]</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="terminal-section">
        <div className="flex mb-3">
          <button
            onClick={() => handleTabChange("send")}
            className={`terminal-button mr-2 ${
              activeTab === "send" ? "terminal-button-active" : "terminal-button-inactive"
            }`}
          >
            [SEND]
          </button>
          <button
            onClick={() => handleTabChange("receive")}
            className={`terminal-button ${
              activeTab === "receive" ? "terminal-button-active" : "terminal-button-inactive"
            }`}
          >
            [RECEIVE]
          </button>
        </div>
        
        <div className="mt-2">
          {activeTab === "send" ? renderSendTab() : renderReceiveTab()}
        </div>
      </div>

      {/* Modals */}
      <Modal 
        type={modal.type}
        isOpen={modal.isOpen}
        onClose={hide}
        title={modal.title}
        message={modal.message}
      />
    </>
  );
};

export default TransferContent;