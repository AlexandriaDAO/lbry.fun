import React, { useState } from "react";
import { Principal } from "@dfinity/principal";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { RootState } from "@/store";
import transferICP from "@/features/icp-ledger/thunks/transferICP";
import transferPrimary from "../../thunks/primaryIcrc/transferPrimary";
import transferSecondary from "../../thunks/secondaryIcrc/transferSecondary";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";
import fetchTransactionHistory from "../../thunks/fetchTransactionHistory.thunk";
import { LoaderCircle } from "lucide-react";
import LoadingModal from "../loadingModal";
import SuccessModal from "../successModal";
import ErrorModal from "../errorModal";
import CopyHelper from "../copyHelper";
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
  const [loadingModalV, setLoadingModalV] = useState(false);
  const [successModalV, setSucessModalV] = useState(false);
  const [errorModalV, setErrorModalV] = useState(false);

  const validatePrincipal = (principalString: string): boolean => {
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
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (Number(e.target.value) >= 0) {
      setAmount(e.target.value);
    }
  };

  const handleSend = async () => {
    if (!validatePrincipal(destinationPrincipal)) return;
    if (!amount || Number(amount) <= 0) {
      setPrincipalError("Amount must be greater than 0");
      return;
    }

    setLoadingModalV(true);
    setErrorModalV(false);

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
        await dispatch(getAccountPrimaryBalance({ 
          tokenCanisterId: swap.activeSwapPool[1].primary_token_canister, 
          principal: Principal.fromText(principal) 
        }));
        await dispatch(getSecondaryBalance({ 
          tokenCanisterId: swap.activeSwapPool[1].secondary_token_canister, 
          principal: Principal.fromText(principal) 
        }));
        await dispatch(fetchTransactionHistory({ 
          principal: Principal.fromText(principal),
          poolId: swap.activeSwapPool[0]
        }));
      }

      setLoadingModalV(false);
      setSucessModalV(true);
      setAmount("0");
      setDestinationPrincipal("");
    } catch (error) {
      setLoadingModalV(false);
      setErrorModalV(true);
    }
  };

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
          onChange={(e) => setSelectedToken(e.target.value)}
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
          onChange={(e) => {
            setDestinationPrincipal(e.target.value);
            validatePrincipal(e.target.value);
          }}
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
            onClick={() => setActiveTab("send")}
            className={`terminal-button mr-2 ${
              activeTab === "send" ? "terminal-button-active" : "terminal-button-inactive"
            }`}
          >
            [SEND]
          </button>
          <button
            onClick={() => setActiveTab("receive")}
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
      <LoadingModal open={loadingModalV} setOpen={setLoadingModalV} />
      <SuccessModal open={successModalV} setOpen={setSucessModalV} />
      <ErrorModal open={errorModalV} setOpen={setErrorModalV} />
    </>
  );
};

export default TransferContent;