import React, { useEffect, useState } from "react";
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
const StakeContent = () => {
    const { theme } = useTheme();
    const dispatch = useAppDispatch();
    const swap = useAppSelector((state) => state.swap);
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const primary = useAppSelector((state) => state.primary);
    const icpLedger = useAppSelector((state) => state.icpLedger);
    const [amount, setAmount] = useState("0");
    const [loadingModalV, setLoadingModalV] = useState(false);
    const [successModalV, setSucessModalV] = useState(false);
    const [actionType, setActionType] = useState("Stake");
    const [errorModalV, setErrorModalV] = useState({ flag: false, title: "", message: "" });
    const [modalData, setModalData] = useState({ message: "Please try again or seek help if needed", title: "Something went wrong..." });
    const [userEstimateReward, setUserEstimatedReward] = useState(0);
    const [apr, setApr] = useState("0");
    const [annualizedApr, setAnnualizedApr] = useState("0");
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!isAuthenticated || !principal)
            return;
        dispatch(stakePrimary({ amount, userPrincipal: principal }));
        setActionType("Stake");
        setLoadingModalV(true);
    };
    const handleAmountChange = (e) => {
        if (Number(e.target.value) < 0) {
            return;
        }
        setAmount(e.target.value);
    };
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
        }
        else {
            setApr(''); // Fallback value if division by zero
            setAnnualizedApr('');
        }
    }, [primary.primaryPriceUsd, icpLedger.icpPrice, swap.averageAPY, swap.stakeInfo.stakedPrimary]);
    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getAccountPrimaryBalance(principal));
        }
    }, [isAuthenticated, principal, dispatch]);
    useEffect(() => {
        if (swap.successStake === true || swap.unstakeSuccess === true || swap.burnSuccess === true || swap.successClaimReward === true) {
            dispatch(flagHandler());
            if (isAuthenticated && principal)
                dispatch(getAccountPrimaryBalance(principal));
            setLoadingModalV(false);
            setSucessModalV(true);
        }
        if (swap.error) {
            if (swap.error && swap.error.message.includes("Must have ")) {
                setModalData({ message: "Must have at least 0.01 ICP reward to claim.", title: "Insufficient Reward " });
            }
            else {
                setModalData({ message: "Please try again or seek help if needed", title: "Something went wrong..." });
            }
            setLoadingModalV(false);
            setErrorModalV({ flag: true, title: swap.error.title, message: swap.error.message });
            dispatch(flagHandler());
        }
    }, [isAuthenticated, principal, swap, dispatch]);
    const primaryTokenLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;
    return (React.createElement(React.Fragment, null,
        React.createElement("style", null, `
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
                `),
        React.createElement("div", null,
            React.createElement("div", { className: 'grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-7' },
                React.createElement("div", { className: 'stake me-2' },
                    React.createElement("div", { className: "mb-4" },
                        React.createElement("label", { className: "flex items-center text-radiocolor dark:text-white" },
                            React.createElement("span", { className: "ml-2 text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold dark:text-white" }, "Stake"))),
                    React.createElement("div", { className: 'border border-gray-400 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white py-5 px-7 rounded-borderbox mb-3' },
                        React.createElement("h2", { className: 'sm:text-2xl xs:text-xl text-radiocolor dark:text-white flex justify-between mb-5' },
                            React.createElement("span", { className: 'flex font-extrabold' }, "Staked"),
                            React.createElement("span", { className: 'font-semibold flex' },
                                swap.stakeInfo.stakedPrimary,
                                "  ",
                                swap.activeSwapPool && swap.activeSwapPool[1]?.primary_token_name)),
                        React.createElement("ul", { className: 'ps-0' },
                            React.createElement("li", { className: 'mb-4' },
                                React.createElement("div", { className: 'flex justify-between' },
                                    React.createElement("strong", { className: 'sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1' }, "Estimated Returns"),
                                    React.createElement("div", { className: 'text-right' },
                                        React.createElement("div", { className: 'flex flex-col items-end' },
                                            React.createElement("div", null,
                                                React.createElement("strong", { className: 'sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold' }, apr),
                                                React.createElement("span", { className: 'text-sm text-gray-500 dark:text-gray-400 ml-1' }, "per hour")),
                                            React.createElement("div", { className: 'text-sm text-gray-500 dark:text-gray-400' },
                                                annualizedApr,
                                                " per year"))))),
                            React.createElement("li", { className: 'mb-4' },
                                React.createElement("div", { className: 'flex justify-between' },
                                    React.createElement("strong", { className: 'sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1' }, "Cumulative Stake by Community"),
                                    React.createElement("strong", { className: 'sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1' },
                                        swap.totalStaked,
                                        "  ",
                                        swap.activeSwapPool && swap.activeSwapPool[1]?.primary_token_name))),
                            React.createElement("li", null,
                                React.createElement("div", { className: 'flex justify-between' },
                                    React.createElement("strong", { className: 'sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1' }, "Stakers"),
                                    React.createElement("strong", { className: 'sm:text-lg xs:text-sm text-radiocolor dark:text-white font-semibold me-1' }, swap.totalStakers))))),
                    React.createElement("div", { className: 'flex items-center mb-3' },
                        React.createElement("strong", { className: 'text-2xl font-medium dark:text-white' }, "Stake Amount")),
                    React.createElement("div", { className: 'border border-gray-400 dark:border-gray-700 bg-white dark:bg-gray-800 py-8 px-5 rounded-borderbox mb-7' },
                        React.createElement("div", { className: 'mb-3' },
                            React.createElement("div", { className: 'flex justify-between mb-5' },
                                React.createElement("h4", { className: 'text-2xl font-medium text-darkgray dark:text-white' }, "Amount"),
                                React.createElement("input", { className: 'text-darkgray dark:text-white mr-[-10px] text-right bg-transparent text-2xl font-medium placeholder-darkgray dark:placeholder-gray-400 w-full focus:outline-none focus:border-transparent', type: 'number', min: 0, value: amount, onChange: (e) => { handleAmountChange(e); }, step: "any" })),
                            React.createElement("div", { className: 'flex justify-between' },
                                React.createElement("div", { className: 'flex items-center' },
                                    React.createElement("strong", { className: 'text-base text-multygray dark:text-gray-400 font-medium me-2' },
                                        "Available Balance:",
                                        React.createElement("span", { className: 'text-base text-darkgray dark:text-white ms-2' },
                                            primary.primaryBal,
                                            "  ",
                                            swap.activeSwapPool && swap.activeSwapPool[1]?.primary_token_name)),
                                    primaryTokenLogoFromState ? (React.createElement("img", { className: 'w-5 h-5', src: primaryTokenLogoFromState, alt: swap.activeSwapPool?.[1]?.primary_token_name || "Primary token logo" })) : (React.createElement("div", { className: 'w-5 h-5 bg-gray-200 rounded-full' }))),
                                React.createElement(Link, { to: "", role: "button", className: 'text-[#A7B1D7] dark:text-gray-400 underline text-base font-bold hover:text-[#8494C7] dark:hover:text-gray-300', onClick: () => handleMaxPrimary() }, "Max")))),
                    React.createElement("div", null,
                        isAuthenticated ? React.createElement("button", { type: "button", className: `bg-[#5555FF] text-white w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 mb-6 ${parseFloat(amount) === 0 || swap.loading ? 'text-[#808080] cursor-not-allowed' : 'bg-balancebox text-white cursor-pointer'}`, style: {
                                backgroundColor: parseFloat(amount) === 0 || swap.loading ? '#bg-[#5555FF]' : '', // when disabled
                            }, disabled: parseFloat(amount) === 0 || swap.loading === true, onClick: (e) => {
                                handleSubmit(e);
                            } }, swap.loading ? (React.createElement(React.Fragment, null,
                            React.createElement(LoaderCircle, { size: 18, className: "animate animate-spin mx-auto" }),
                            " ")) : (React.createElement(React.Fragment, null, "Stake"))) : React.createElement("div", { className: "bg-balancebox text-white w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 flex items-center justify-center white-auth-btn mb-4" },
                            React.createElement(Entry, null)),
                        React.createElement("div", { className: "terms-condition-wrapper flex tems-baseline" },
                            React.createElement("span", { className: "text-[#FF37374D] mr-2 text-xl font-semibold" }, "*"),
                            React.createElement("p", { className: "sm:text-lg xs:text-sm font-semibold pr-5 text-[#525252] dark:text-gray-400 w-9/12" }, "If the transaction doesn't complete as expected, please check the redeem page to locate your tokens."))))),
            React.createElement("div", { className: "overflow-x-auto lg:overflow-x-auto" },
                React.createElement(StakedInfo, { setLoadingModalV: setLoadingModalV, setActionType: setActionType, userEstimateReward: userEstimateReward })),
            React.createElement(LoadingModal, { show: loadingModalV, message1: `${actionType} in Progress`, message2: "Transaction is being processed. This may take a few moments.", setShow: setLoadingModalV }),
            React.createElement(SuccessModal, { show: successModalV, setShow: setSucessModalV }),
            React.createElement(ErrorModal, { show: errorModalV.flag, setShow: setErrorModalV, title: errorModalV.title, message: errorModalV.message }))));
};
export default StakeContent;
