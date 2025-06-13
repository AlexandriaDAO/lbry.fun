import React, { useEffect, useState } from "react";

import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { _SERVICE as _SERVICESWAP } from "../../../../../../declarations/icp_swap/icp_swap.did";
import { _SERVICE as _SERVICEICPLEDGER } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";

import { Link } from "react-router";
import swapSecondary from "../../thunks/swapSecondary";
import { flagHandler } from "../../swapSlice";
import { LoaderCircle } from "lucide-react";
import { icp_fee, minimum_icp } from "@/utils/utils";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";
import SuccessModal from "../successModal";
import LoadingModal from "../loadingModal";
import ErrorModal from "../errorModal";
import { Entry } from "@/layouts/parts/Header";
import { RootState } from "@/store";


const SwapContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
  const icpLedger = useAppSelector((state: RootState) => state.icpLedger);
  const swap = useAppSelector((state: RootState) => state.swap);
  const [amount, setAmount] = useState("");
  const [secondaryRatio, setSecondaryRatio] = useState(0.0);
  const [tentativeSecondary, setTentativeSecondary] = useState(Number);
  const [loadingModalV, setLoadingModalV] = useState(false);
  const [successModalV, setSucessModalV] = useState(false);
  const [errorModalV, setErrorModalV] = useState({ flag: false, title: "", message: "" });

  const [inputState, setInputState] = useState<'default' | 'error' | 'focus'>('default');

  const handleSubmit = () => {
    if (!isAuthenticated || !principal || !swap.activeSwapPool?.[1].icp_swap_canister_id) return;
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
  return (
    <div>
      <div className="mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5">
        <h3 className="text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold text-foreground">
          Swap
        </h3>
      </div>
      <div className="grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-1 sm:grid-cols-1">
        <div className="me-0 2xl:me-2 xl:me-2 lg:me-2 md:me-0 sm:me-0 mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-3 sm:mb-3">
          <div className="block 2xl:flex xl:flex lg:flex md:flex sm:block justify-between mb-5 w-full">
            <div className={`bg-card border ${inputState === 'error' ? 'border-destructive ring-2 ring-destructive/20' : inputState === 'focus' ? 'border-primary ring-2 ring-primary/20' : 'border-border'} py-5 px-7 rounded-borderbox me-0 2xl:me-2 xl:me-2 lg:me-2 md:me-2 sm:me-0 w-full 2xl:w-6/12 xl:w-6/12 lg:w-6/12 md:w-6/12 sm:w-full mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3`}>
              <div className="flex justify-between mb-5">
                <h2 className="text-swapheading 2xl:text-xxlswapheading xl:text-xlswapheading lg:text-lgswapheading md:text-mdswapheading ms:text-smswapheading font-medium text-foreground me-2">
                  ICP
                </h2>
                <div>
                  <input
                    className="text-foreground text-right text-swapheading 2xl:text-xxlswapheading xl:text-xlswapheading lg:text-lgswapheading md:text-mdswapheading ms:text-smswapheading bg-transparent placeholder-muted-foreground focus:outline-none focus:border-transparent w-full caret-primary"
                    type="text"
                    value={amount + ""}
                    min="0"
                    onChange={(e) => {
                      handleAmountChange(e);
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <strong className="text-base text-foreground font-medium me-1">
                  Balance:{icpLedger.accountBalance}
                </strong>

                <Link
                  role="button"
                  className="text-base font-blod text-primary underline"
                  to={""}
                  onClick={() => handleMaxIcp()}
                >
                  Max
                </Link>
              </div>
            </div>
            <div className="bg-card border border-border py-5 px-7 rounded-borderbox me-0 2xl:ms-2 xl:ms-2 lg:ms-2 md:ms-2 sm:me-0 w-full 2xl:w-6/12 xl:w-6/12 lg:w-6/12 md:w-6/12 sm:w-full">
              <div className="flex justify-between mb-5 flex-wrap break-all">
                <h2 className="text-swapheading 2xl:text-xxlswapheading xl:text-xlswapheading lg:text-lgswapheading md:text-mdswapheading ms:text-smswapheading font-medium text-foreground">
                  {swap.activeSwapPool?.[1].secondary_token_symbol}
                </h2>
                <h3 className="text-swapvalue text-right text-swapheading 2xl:text-xxlswapheading xl:text-xlswapheading lg:text-lgswapheading md:text-mdswapheading ms:text-smswapheading font-medium text-foreground">
                  {tentativeSecondary.toFixed(4)}
                </h3>
              </div>
              <div className="flex justify-between">
                <strong className="text-base text-muted-foreground font-medium me-1">
                  Balance: {swap.secondaryBalance} {swap.activeSwapPool?.[1].secondary_token_symbol}
                </strong>
              </div>
            </div>
          </div>
          <div className="terms-condition-wrapper flex tems-baseline mb-4">
            <p className="text-lg font-semibold pr-5 text-muted-foreground w-9/12">{parseFloat(amount) < minimum_icp ? <>Please enter at least the minimum amount to proceed</> : <></>}</p>
          </div>
          <div>
            {isAuthenticated ? (
              <button
                type="button"
                className={`w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 mb-6 
      ${parseFloat(amount) === 0 || amount === "" || parseFloat(amount) < minimum_icp || swap.loading ? 'text-[#fff] cursor-not-allowed' : 'bg-balancebox text-white cursor-pointer'}`}
                style={{
                  backgroundColor: parseFloat(amount) === 0 || amount === "" || parseFloat(amount) < minimum_icp || swap.loading ? '#5555FF' : '', // when disabled
                }}
                disabled={parseFloat(amount) === 0 || swap.loading || parseFloat(amount) < minimum_icp || amount === ""}
                onClick={handleSubmit}
              >
                {swap.loading ? (
                  <LoaderCircle size={18} className="animate-spin mx-auto" />
                ) : (
                  <>Swap</>
                )}
              </button>
            ) : (
              <div
                className="bg-balancebox text-white w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 flex items-center justify-center white-auth-btn"
              >
                <Entry />
              </div>
            )}
            <div className="terms-condition-wrapper flex tems-baseline">
              <span className="text-[#FF37374D] mr-2 text-xl font-semibold">*</span>
              <p className="text-lg font-semibold pr-5 text-muted-foreground w-9/12">If the transaction doesn't complete as expected, please check the redeem page to locate your tokens.</p>
            </div>
          </div>
        </div>
        <div className="border border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-800 py-5 px-5 rounded-2xl ms-3">
          <ul className="ps-0">
            <li className="flex justify-between mb-5">
              <strong className="lg:text-lg md:text-base sm:text-sm font-semibold me-1 text-radiocolor dark:text-gray-200">
                Network Fees
              </strong>
              <span className="lg:text-lg md:text-base sm:text-sm font-semibold text-radiocolor dark:text-gray-200">
                {icp_fee} ICP
              </span>
            </li>
            <li className="flex justify-between mb-5">
              <strong className="lg:text-lg md:text-base sm:text-sm font-semibold me-1 text-radiocolor dark:text-gray-200">
                Send
              </strong>
              <span className="lg:text-lg md:text-base sm:text-sm font-semibold text-radiocolor dark:text-gray-200 break-all">
                {amount} ICP
              </span>
            </li>
            <li className="flex justify-between mb-5">
              <strong className="lg:text-lg md:text-base sm:text-sm font-semibold me-1 text-radiocolor dark:text-gray-200">
                Receive
              </strong>
              <span className="lg:text-lg md:text-base sm:text-sm font-semibold text-radiocolor dark:text-gray-200 break-all">
                {tentativeSecondary.toFixed(4)} {swap.activeSwapPool?.[1].secondary_token_symbol}
              </span>
            </li>
            <li className="flex justify-between mb-5">
              <strong className="lg:text-lg md:text-base sm:text-sm font-semibold me-1 text-radiocolor dark:text-gray-200">
                For each ICP you swap, you'll receive <span className="text-[#FF9900] dark:text-yellow-400">{tentativeSecondary}</span> {swap.activeSwapPool?.[1].secondary_token_symbol} tokens.
              </strong>
            </li>
            <li>
              <strong className="lg:text-lg md:text-base sm:text-sm font-semibold me-1 text-radiocolor dark:text-gray-200">
                Please review the details carefully, as swaps are irreversible and cannot be undone once confirmed.
              </strong>
            </li>
          </ul>
        </div>
      </div>


      <LoadingModal show={loadingModalV} message1={"Swap in Progress"} message2={`Your transaction from ICP to  ${swap.activeSwapPool?.[1].secondary_token_symbol}  is being processed. This may take a few moments`} setShow={setLoadingModalV} />
      <SuccessModal show={successModalV} setShow={setSucessModalV} />
      <ErrorModal show={errorModalV.flag} setShow={setErrorModalV} title={errorModalV.title} message={errorModalV.message} />
    </div>
  );
};
export default SwapContent;
