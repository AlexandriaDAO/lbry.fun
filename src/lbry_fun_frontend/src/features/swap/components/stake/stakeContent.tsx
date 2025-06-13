import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";

import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";

import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
import { flagHandler } from "../../swapSlice";
import stakePrimary from "../../thunks/stakePrimary";
import StakedInfo from "./stakeInfo";
import { LoaderCircle } from "lucide-react";
import LoadingModal from "../loadingModal";
import SuccessModal from "../successModal";
import ErrorModal from "../errorModal";
import { Entry } from "@/layouts/parts/Header";
import { RootState } from "@/store";

const StakeContent = () => {
    const { theme } = useTheme();
    const dispatch = useAppDispatch();

    const swap = useAppSelector((state: RootState) => state.swap);
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const primary = useAppSelector((state: RootState) => state.primary);
    const icpLedger = useAppSelector((state: RootState) => state.icpLedger);

    const [amount, setAmount] = useState("0");
    const [loadingModalV, setLoadingModalV] = useState(false);
    const [successModalV, setSucessModalV] = useState(false);
    const [actionType, setActionType] = useState("Stake");
    const [errorModalV, setErrorModalV] = useState({ flag: false, title: "", message: "" });
    const [modalData, setModalData] = useState({ message: "Please try again or seek help if needed", title: "Something went wrong..." });
    const [userEstimateReward, setUserEstimatedReward] = useState(0);
    const [apr, setApr] = useState("0");
    const [annualizedApr, setAnnualizedApr] = useState("0");

    const handleSubmit = (event: any) => {
        event.preventDefault();
        if (!isAuthenticated || !principal) return;
        dispatch(stakePrimary({ amount, userPrincipal: principal }));
        setActionType("Stake");
        setLoadingModalV(true);
    }
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (Number(e.target.value) < 0) {
            return;
        }
        setAmount(e.target.value);
    }
    const handleMaxPrimary = () => {
        const userBal = Math.max(0, Number(primary.primaryBal) - Number(primary.primaryFee)).toFixed(4);
        setAmount(userBal);
    };

    useEffect(() => {
        const estimatedUserRewardIcp = Number(swap.stakeInfo.stakedPrimary) * swap.averageAPY;
        setUserEstimatedReward(estimatedUserRewardIcp);

        const estimatedRewardIcp = Number(swap.totalStaked) * swap.averageAPY;
        const stakedUsd = Number(swap.totalStaked) * Number(primary.primaryPriceUsd);

        // Check if `stakedUsd` is valid before dividing
        if (stakedUsd > 0) {
            const hourlyAprPercentage = ((estimatedRewardIcp * Number(icpLedger.icpPrice)) / stakedUsd) * 100;
            const annualAprPercentage = hourlyAprPercentage * 24 * 365; // Convert hourly to annual
            setApr(hourlyAprPercentage.toFixed(4) + "%");
            setAnnualizedApr(annualAprPercentage.toFixed(2) + "%");
        } else {
            setApr(''); // Fallback value if division by zero
            setAnnualizedApr('');
        }
    }, [primary.primaryPriceUsd, icpLedger.icpPrice, swap.averageAPY, swap.stakeInfo.stakedPrimary]);


    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getAccountPrimaryBalance(principal))
        }
    }, [isAuthenticated, principal, dispatch])

    useEffect(() => {

        if (swap.successStake === true || swap.unstakeSuccess === true || swap.burnSuccess === true || swap.successClaimReward === true) {
            dispatch(flagHandler());
            if (isAuthenticated && principal) dispatch(getAccountPrimaryBalance(principal))
            setLoadingModalV(false);
            setSucessModalV(true);
        }
        if (swap.error) {
            if (swap.error && swap.error.message.includes("Must have ")) {
                setModalData({ message: "Must have at least 0.01 ICP reward to claim.", title: "Insufficient Reward " })
            }
            else {
                setModalData({ message: "Please try again or seek help if needed", title: "Something went wrong..." })
            }
            setLoadingModalV(false);
            setErrorModalV({ flag: true, title: swap.error.title, message: swap.error.message });
            dispatch(flagHandler());

        }
    }, [isAuthenticated, principal, swap, dispatch])

    const primaryTokenLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;

    return (
        <>
            <style>
                {`
                /* Hide number input spinners for Chrome, Safari, Edge, Opera */
                input[type="number"]::-webkit-inner-spin-button,
                input[type="number"]::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }

                /* Hide number input spinners for Firefox */
                input[type="number"] {
                    -moz-appearance: textfield;
                }
                `}
            </style>
            <div>
                <div className='grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-7'>
                    <div className='stake me-2'>
                        <div className="mb-4">
                            <label className="flex items-center text-radiocolor dark:text-white">
                                <span className="ml-2 text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold dark:text-white">Stake</span>
                            </label>
                        </div>
                        <div className='border border-gray-400 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white py-5 px-7 rounded-borderbox mb-3'>
                            <h2 className='sm:text-2xl xs:text-xl text-radiocolor dark:text-white flex justify-between mb-5'>
                                <span className='flex font-extrabold'>Staked</span>
                                <span className='font-semibold flex'>{swap.stakeInfo.stakedPrimary}  {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_name}</span>
                            </h2>
                            <ul className='ps-0'>
                                <li className='mb-4'>
                                    <div className='flex justify-between'>
                                        <strong className='sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1'>Estimated Returns</strong>
                                        <div className='text-right'>
                                            <div className='flex flex-col items-end'>
                                                <div>
                                                    <strong className='sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold'>{apr}</strong>
                                                    <span className='text-sm text-gray-500 dark:text-gray-400 ml-1'>per hour</span>
                                                </div>
                                                <div className='text-sm text-gray-500 dark:text-gray-400'>
                                                    {annualizedApr} per year
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                                {/* <li className='mb-4'>
                                    <div className='flex justify-between border-b-2 pb-4'>
                                        <strong className='sm:text-lg xs:text-sm text-radiocolor font-semibold me-1'>Total earned</strong>
                                        <strong className='sm:text-lg xs:text-sm text-radiocolor font-semibold me-1'>0 ALEX</strong>
                                    </div>
                                </li> */}
                                <li className='mb-4'>
                                    <div className='flex justify-between'>
                                        <strong className='sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1'>Cumulative Stake by Community</strong>
                                        <strong className='sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1'>{swap.totalStaked}  {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_name}</strong>
                                    </div>
                                </li>
                                <li>
                                    <div className='flex justify-between'>
                                        <strong className='sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1'>Stakers</strong>
                                        <strong className='sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1'>{swap.totalStakers}</strong>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className='flex items-center mb-3'>
                            <strong className='text-2xl font-medium dark:text-white'>Stake Amount</strong>
                        </div>
                        <div className='border border-gray-400 dark:border-gray-700 bg-white dark:bg-gray-800 py-8 px-5 rounded-borderbox mb-7'>
                            <div className='mb-3'>
                                <div className='flex justify-between mb-5'>
                                    <h4 className='text-2xl font-medium text-darkgray dark:text-white'>Amount</h4>
                                    <input
                                        className='text-darkgray dark:text-white mr-[-10px] text-right bg-transparent text-2xl font-medium placeholder-darkgray dark:placeholder-gray-400 w-full focus:outline-none focus:border-transparent'
                                        type='number'
                                        min={0}
                                        value={amount}
                                        onChange={(e) => { handleAmountChange(e) }}
                                        step="any"
                                    />
                                </div>
                                <div className='flex justify-between'>
                                    <div className='flex items-center'>
                                        <strong className='text-base text-multygray dark:text-gray-400 font-medium me-2'>Available Balance:<span className='text-base text-darkgray dark:text-white ms-2'>{primary.primaryBal}  {swap.activeSwapPool&& swap.activeSwapPool[1]?.primary_token_name}</span></strong>
                                        {primaryTokenLogoFromState ? (
                                            <img className='w-5 h-5' src={primaryTokenLogoFromState} alt={swap.activeSwapPool?.[1]?.primary_token_name || "Primary token logo"} />
                                        ) : (
                                            <div className='w-5 h-5 bg-gray-200 rounded-full'></div>
                                        )}
                                    </div>
                                    <Link to="" role="button" className='text-[#A7B1D7] dark:text-gray-400 underline text-base font-bold hover:text-[#8494C7] dark:hover:text-gray-300' onClick={() => handleMaxPrimary()} >Max</Link>
                                </div>
                            </div>
                        </div>
                        <div>
                            {isAuthenticated ? <button
                                type="button"
                                className={`bg-interactive-primary text-primary-foreground w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 mb-6 ${parseFloat(amount) === 0 || swap.loading ? 'text-muted-foreground cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                style={{
                                    opacity: parseFloat(amount) === 0 || swap.loading ? 0.5 : 1, // when disabled
                                }}
                                disabled={parseFloat(amount) === 0 || swap.loading === true}
                                onClick={(e) => {
                                    handleSubmit(e);
                                }}
                            >
                                {swap.loading ? (<>
                                    <LoaderCircle size={18} className="animate animate-spin mx-auto" /> </>) : (
                                    <>Stake</>
                                )}
                            </button> : <div
                                className="bg-balancebox text-white w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 flex items-center justify-center white-auth-btn mb-4"
                            >
                                <Entry />
                            </div>}
                            <div className="terms-condition-wrapper flex tems-baseline">
                                <span className="text-[#FF37374D] mr-2 text-xl font-semibold">*</span>
                                <p className="sm:text-lg xs:text-sm font-semibold pr-5 text-muted-foreground w-9/12">If the transaction doesn't complete as expected, please check the redeem page to locate your tokens.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto lg:overflow-x-auto">
                    <StakedInfo setLoadingModalV={setLoadingModalV} setActionType={setActionType} userEstimateReward={userEstimateReward} />
                </div>
                <LoadingModal show={loadingModalV} message1={`${actionType} in Progress`} message2={"Transaction is being processed. This may take a few moments."} setShow={setLoadingModalV} />
                <SuccessModal show={successModalV} setShow={setSucessModalV} />
                <ErrorModal show={errorModalV.flag} setShow={setErrorModalV} title={errorModalV.title} message={errorModalV.message} />

            </div>
        </>
    );
};
export default StakeContent;
