import React, { useEffect, useState } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did'
import { _SERVICE as _SERVICESECONDARY } from '../../../../../../ICRC/ICRC.did'

import { Link } from "react-router-dom";
import { flagHandler } from "../../swapSlice";
import burnSecondary from "../../thunks/burnSecondary";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";
import { LoaderCircle } from "lucide-react";
import getCanisterBal from "@/features/icp-ledger/thunks/getCanisterBal";
import getCanisterArchivedBal from "../../thunks/getCanisterArchivedBal";
import LoadingModal from "../loadingModal";
import SuccessModal from "../successModal";
import ErrorModal from "../errorModal";
import BurnInfo from "./burnInfo";
import calculateMaxBurnAllowed from "./calculateMaxBurnAllowed";
import { Entry } from "@/layouts/parts/Header";
import { RootState } from "@/store";

const BurnContent = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const swap = useAppSelector((state: RootState) => state.swap);
    const icpLedger = useAppSelector((state: RootState) => state.icpLedger);
    const tokenomics = useAppSelector((state: RootState) => state.tokenomics);

    const [amountSecondary, setAmountSecondary] = useState(0);
    const [tentativeICP, setTentativeICP] = useState(0);
    const [tentativePrimary, setTentativePrimary] = useState(0);
    const [loadingModalV, setLoadingModalV] = useState(false);
    const [successModalV, setSucessModalV] = useState(false);
    const [errorModalV, setErrorModalV] = useState({ flag: false, title: "", message: "" });
    const [maxBurnAllowed, setMaxburnAllowed] = useState(0);

    const handleSubmit = (event: any) => {
        event.preventDefault();
        if (!isAuthenticated || !principal) return;
        
        // Debug logging for burn calculation
        console.log("Burn Debug Info:", {
            amountSecondary,
            maxBurnAllowed,
            secondaryRatio: swap.secondaryRatio,
            canisterBalance: icpLedger.canisterBalance,
            canisterArchivedBal: swap.canisterArchivedBal.canisterArchivedBal,
            canisterUnClaimedIcp: swap.canisterArchivedBal.canisterUnClaimedIcp,
            tentativeICP,
            tentativePrimary
        });
        
        // Add frontend validation to prevent burns exceeding max allowed
        if (maxBurnAllowed === 0) {
            setErrorModalV({
                flag: true,
                title: "Burning Not Available",
                message: "The canister has insufficient ICP balance. Someone needs to mint secondary tokens first to add ICP to the pool."
            });
            return;
        }
        
        if (amountSecondary > maxBurnAllowed) {
            setErrorModalV({
                flag: true,
                title: "Burn Amount Exceeds Maximum",
                message: `Maximum burn allowed is ${maxBurnAllowed.toFixed(4)} based on available canister balance`
            });
            return;
        }
        
        dispatch(burnSecondary({ amount: amountSecondary.toString(), userPrincipal: principal }));
        setLoadingModalV(true);
    }
    const handleAmountSecondaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {

        if (Number(e.target.value) >= 0) {

            const amount = Number(e.target.value);
            setAmountSecondary(amount);
            
            const ratio = Number(swap.secondaryRatio) || 0;
            const icpAmount = ratio > 0 ? (amount / ratio) / 2 : 0;
            setTentativeICP(isNaN(icpAmount) ? 0 : icpAmount);
            
            const mintRate = Number(tokenomics.primaryMintRate) || 0;
            const primaryAmount = amount * mintRate;
            setTentativePrimary(isNaN(primaryAmount) ? 0 : primaryAmount);
        }
    }
    const handleMaxLbry = () => {
        const userBal = Math.floor(Math.max(0, Number(swap.secondaryBalance) - Number(swap.secondaryFee))); // Ensure non-negative user balance
        const secondaryRatio = Number(swap.secondaryRatio);
        const primaryMintRate = Number(tokenomics.primaryMintRate);

        setAmountSecondary(userBal);
        
        const icpAmount = secondaryRatio > 0 ? userBal / (secondaryRatio * 2) : 0;
        setTentativeICP(isNaN(icpAmount) ? 0 : icpAmount);
        
        const primaryAmount = userBal * (primaryMintRate || 0);
        setTentativePrimary(isNaN(primaryAmount) ? 0 : primaryAmount);
    };

    useEffect(() => {
        if (!isAuthenticated || !principal) return;
        if (swap.burnSuccess === true && swap.activeSwapPool) {
            dispatch(flagHandler())
            dispatch(getSecondaryBalance(principal))
            setLoadingModalV(false);
            setSucessModalV(true);
            setMaxburnAllowed(calculateMaxBurnAllowed(
                swap.secondaryRatio, 
                icpLedger.canisterBalance, 
                swap.canisterArchivedBal?.canisterArchivedBal || 0, 
                swap.canisterArchivedBal?.canisterUnClaimedIcp || 0
            ))
        }
        if (swap.error && swap.activeSwapPool) {
            dispatch(getSecondaryBalance(principal));
            setLoadingModalV(false);
            setErrorModalV({flag:true,title:swap.error.title,message:swap.error.message});
            dispatch(flagHandler());
        }
    }, [isAuthenticated, principal, swap, icpLedger.canisterBalance, tokenomics.primaryMintRate, dispatch]);

    // getCanisterArchivedBal is now loaded as critical data in useSwapDataLoader

    useEffect(() => {
        setMaxburnAllowed(calculateMaxBurnAllowed(
            swap.secondaryRatio, 
            icpLedger.canisterBalance, 
            swap.canisterArchivedBal?.canisterArchivedBal || 0, 
            swap.canisterArchivedBal?.canisterUnClaimedIcp || 0
        ))
    }, [swap.activeSwapPool, swap.canisterArchivedBal, swap.secondaryRatio, icpLedger.canisterBalance]);

    const primaryLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;
    const secondaryLogoFromState = swap.activeSwapPool?.[1]?.secondary_token_logo_base64;

    return (
        <>
            <div>
                <div className='mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5'>
                    <h3 className="text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold">Burn</h3>
                </div>
                <div className='grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-12'>
                    <div className='me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 mb-3 2xl:mb-0 xl:mb-0 lg:mb-3 md:mb-3 sm:mb-3'>
                        <div className='bg-white bg-gray-800 border border-gray-700 py-5 px-5 rounded-borderbox mb-7'>
                            <div className='flex justify-between mb-3'>
                                <h4 className='lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium text-multygray text-gray-300'>Amount</h4>
                                <input className='lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium text-darkgray text-gray-200 text-right bg-transparent w-full placeholder-darkgray placeholder-gray-400 focus:outline-none focus:border-transparent' type='integer' value={amountSecondary + ""} min={0} onChange={(e) => {
                                    handleAmountSecondaryChange(e)
                                }} />
                            </div>
                            <div className='flex justify-between'>
                                <div className='flex items-center'>
                                    <strong className='text-base text-multygray text-gray-300 font-medium me-1'>Balance:<span className='text-darkgray text-gray-200 ms-2'>{swap.secondaryBalance} {swap?.activeSwapPool&&swap?.activeSwapPool[1]?.secondary_token_symbol}</span></strong>
                                    {secondaryLogoFromState ? (
                                        <img className='w-4 h-4' src={secondaryLogoFromState} alt={swap.activeSwapPool?.[1]?.secondary_token_symbol || "Secondary token logo"} />
                                    ) : (
                                        <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center">
                                            {/* Optional: Add a placeholder or text if needed */}
                                        </div>
                                    )}
                                </div>
                                <Link to="" role="button" className='text-[#A7B1D7] text-blue-400 underline text-base font-bold' onClick={() => handleMaxLbry()} >Max</Link>
                            </div>
                        </div>
                        <h5 className='text-xl font-medium mb-4 text-gray-200'>you get</h5>
                        <div className='border border-gray-700 bg-[#efefef] bg-gray-800 py-4 px-5 rounded-full mb-4'>
                            <div className='flex justify-between'>
                                <div className='flex items-center'>
                                    <div className='me-3'>
                                        <img className='w-6 h-6' src="images/8-logo.png" alt="icp" />
                                    </div>
                                    <div>
                                        <h4 className=' lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium'>ICP</h4>
                                    </div>
                                </div>
                                <h3 className={`text-right  lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium ${amountSecondary > maxBurnAllowed ? 'text-red-500' : ''}`}>
                                    {tentativeICP.toFixed(4)}
                                </h3>
                            </div>
                        </div>
                        <div className='border border-gray-700 bg-[#efefef] bg-gray-800 py-4 px-5 rounded-full mb-4'>
                            <div className='flex justify-between'>
                                <div className='flex items-center'>
                                    <div className='me-3'>
                                        {primaryLogoFromState ? (
                                            <img className='w-6 h-6' src={primaryLogoFromState} alt={swap.activeSwapPool?.[1]?.primary_token_symbol || "Primary token logo"} />
                                        ) : (
                                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                                                {/* Optional: Add a placeholder or text if needed */}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className=' lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium'>{swap.activeSwapPool&&swap.activeSwapPool[1].primary_token_symbol}</h4>
                                    </div>
                                </div>
                                <h3 className={`text-right  lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium`}>
                                    {tentativePrimary.toFixed(4)}
                                </h3>
                            </div>
                        </div>
                        {isAuthenticated ? <button
                            type="button"
                            className={`bg-interactive-primary text-primary-foreground w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 mb-4 ${parseInt(amountSecondary.toString()) === 0 ||
                                    swap.loading ||
                                    amountSecondary > maxBurnAllowed
                                    ? 'text-muted-foreground cursor-not-allowed opacity-50'
                                    : 'cursor-pointer'
                                }`}
                            style={{
                                opacity: parseInt(amountSecondary.toString()) === 0 ||
                                    swap.loading ||
                                    amountSecondary > maxBurnAllowed
                                    ? 0.5
                                    : 1, // when disabled
                            }}
                            disabled={
                                amountSecondary === 0 ||
                                swap.loading === true ||
                                amountSecondary > maxBurnAllowed
                            }
                            onClick={(e) => {
                                handleSubmit(e);
                            }}
                        >
                            {swap.loading ? (<>
                                <LoaderCircle size={18} className="animate animate-spin mx-auto" /> </>) : (
                                <>Burn</>
                            )}
                        </button> : <div
                            className="bg-balancebox text-white w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 flex items-center justify-center white-auth-btn mb-4"
                        >
                            <Entry />
                        </div>}
                        <div className="terms-condition-wrapper flex tems-baseline">
                            <span className="text-[#FF37374D] mr-2 text-xl font-semibold">*</span>
                            <p className="lg:text-lg md:text-base sm:text-sm font-semibold md:pr-5 xs:pr-0 text-muted-foreground md:w-9/12 xs:w-full">If the transaction doesn't complete as expected, please check the redeem page to locate your tokens.</p>
                        </div>
                    </div>
                    <BurnInfo maxBurnAllowed={maxBurnAllowed} />

                </div>
                <LoadingModal show={loadingModalV} message1={"Burn in Progress"} message2={"Burn transaction is being processed. This may take a few moments."} setShow={setLoadingModalV} />
                <SuccessModal show={successModalV} setShow={setSucessModalV} />
                <ErrorModal show={errorModalV.flag} setShow={setErrorModalV} title={errorModalV.title} message={errorModalV.message} />

            </div>
        </>
    );
};
export default BurnContent;
