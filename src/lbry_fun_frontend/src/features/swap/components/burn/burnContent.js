import React, { useEffect, useState } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
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
const BurnContent = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const swap = useAppSelector((state) => state.swap);
    const icpLedger = useAppSelector((state) => state.icpLedger);
    const tokenomics = useAppSelector((state) => state.tokenomics);
    const [amountSecondary, setAmountSecondary] = useState(0);
    const [tentativeICP, setTentativeICP] = useState(Number);
    const [tentativePrimary, setTentativePrimary] = useState(Number);
    const [loadingModalV, setLoadingModalV] = useState(false);
    const [successModalV, setSucessModalV] = useState(false);
    const [errorModalV, setErrorModalV] = useState({ flag: false, title: "", message: "" });
    const [maxBurnAllowed, setMaxburnAllowed] = useState(Number);
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!isAuthenticated || !principal)
            return;
        dispatch(burnSecondary({ amount: amountSecondary.toString(), userPrincipal: principal }));
        setLoadingModalV(true);
    };
    const handleAmountSecondaryChange = (e) => {
        if (Number(e.target.value) >= 0) {
            setAmountSecondary(Number(e.target.value));
            setTentativeICP((Number(e.target.value) / Number(swap.secondaryRatio)) / 2);
            setTentativePrimary(Number(e.target.value) * Number(tokenomics.primaryMintRate));
        }
    };
    const handleMaxLbry = () => {
        const userBal = Math.floor(Math.max(0, Number(swap.secondaryBalance) - Number(swap.secondaryFee))); // Ensure non-negative user balance
        const secondaryRatio = Number(swap.secondaryRatio);
        const primaryMintRate = Number(tokenomics.primaryMintRate);
        setAmountSecondary(userBal);
        setTentativeICP(userBal / (secondaryRatio * 2));
        setTentativePrimary(userBal * primaryMintRate);
    };
    useEffect(() => {
        if (!isAuthenticated || !principal)
            return;
        if (swap.burnSuccess === true && swap.activeSwapPool) {
            dispatch(flagHandler());
            dispatch(getSecondaryBalance(principal));
            setLoadingModalV(false);
            setSucessModalV(true);
            setMaxburnAllowed(calculateMaxBurnAllowed(swap.secondaryRatio, icpLedger.canisterBalance, swap.canisterArchivedBal.canisterArchivedBal, swap.canisterArchivedBal.canisterUnClaimedIcp));
        }
        if (swap.error && swap.activeSwapPool) {
            dispatch(getSecondaryBalance(principal));
            setLoadingModalV(false);
            setErrorModalV({ flag: true, title: swap.error.title, message: swap.error.message });
            dispatch(flagHandler());
        }
    }, [isAuthenticated, principal, swap, icpLedger.canisterBalance, tokenomics.primaryMintRate, dispatch]);
    useEffect(() => {
        if (isAuthenticated && principal && swap.activeSwapPool) {
            dispatch(getSecondaryBalance(principal));
        }
        dispatch(getCanisterBal());
        dispatch(getCanisterArchivedBal());
    }, [isAuthenticated, principal, swap.activeSwapPool, dispatch]);
    useEffect(() => {
        setMaxburnAllowed(calculateMaxBurnAllowed(swap.secondaryRatio, icpLedger.canisterBalance, swap.canisterArchivedBal.canisterArchivedBal, swap.canisterArchivedBal.canisterUnClaimedIcp));
    }, [swap.canisterArchivedBal, swap.secondaryRatio, icpLedger.canisterBalance]);
    const primaryLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;
    const secondaryLogoFromState = swap.activeSwapPool?.[1]?.secondary_token_logo_base64;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement("div", { className: 'mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5' },
                React.createElement("h3", { className: "text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold" }, "Burn")),
            React.createElement("div", { className: 'grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-12' },
                React.createElement("div", { className: 'me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 mb-3 2xl:mb-0 xl:mb-0 lg:mb-3 md:mb-3 sm:mb-3' },
                    React.createElement("div", { className: 'bg-white dark:bg-gray-800 border dark:border-gray-700 py-5 px-5 rounded-borderbox mb-7' },
                        React.createElement("div", { className: 'flex justify-between mb-3' },
                            React.createElement("h4", { className: 'lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium text-multygray dark:text-gray-300' }, "Amount"),
                            React.createElement("input", { className: 'lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium text-darkgray dark:text-gray-200 text-right bg-transparent w-full placeholder-darkgray dark:placeholder-gray-400 focus:outline-none focus:border-transparent', type: 'integer', value: amountSecondary + "", min: 0, onChange: (e) => {
                                    handleAmountSecondaryChange(e);
                                } })),
                        React.createElement("div", { className: 'flex justify-between' },
                            React.createElement("div", { className: 'flex items-center' },
                                React.createElement("strong", { className: 'text-base text-multygray dark:text-gray-300 font-medium me-1' },
                                    "Balance:",
                                    React.createElement("span", { className: 'text-darkgray dark:text-gray-200 ms-2' },
                                        swap.secondaryBalance,
                                        " ",
                                        swap?.activeSwapPool && swap?.activeSwapPool[1]?.secondary_token_symbol)),
                                secondaryLogoFromState ? (React.createElement("img", { className: 'w-4 h-4', src: secondaryLogoFromState, alt: swap.activeSwapPool?.[1]?.secondary_token_symbol || "Secondary token logo" })) : (React.createElement("div", { className: "w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center" }))),
                            React.createElement(Link, { to: "", role: "button", className: 'text-[#A7B1D7] dark:text-blue-400 underline text-base font-bold', onClick: () => handleMaxLbry() }, "Max"))),
                    React.createElement("h5", { className: 'text-xl font-medium mb-4 dark:text-gray-200' }, "you get"),
                    React.createElement("div", { className: 'border dark:border-gray-700 bg-[#efefef] dark:bg-gray-800 py-4 px-5 rounded-full mb-4' },
                        React.createElement("div", { className: 'flex justify-between' },
                            React.createElement("div", { className: 'flex items-center' },
                                React.createElement("div", { className: 'me-3' },
                                    React.createElement("img", { className: 'w-6 h-6', src: "images/8-logo.png", alt: "icp" })),
                                React.createElement("div", null,
                                    React.createElement("h4", { className: ' lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium' }, "ICP"))),
                            React.createElement("h3", { className: `text-right  lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium ${amountSecondary > maxBurnAllowed ? 'text-red-500' : ''}` }, tentativeICP.toFixed(4)))),
                    React.createElement("div", { className: 'border dark:border-gray-700 bg-[#efefef] dark:bg-gray-800 py-4 px-5 rounded-full mb-4' },
                        React.createElement("div", { className: 'flex justify-between' },
                            React.createElement("div", { className: 'flex items-center' },
                                React.createElement("div", { className: 'me-3' }, primaryLogoFromState ? (React.createElement("img", { className: 'w-6 h-6', src: primaryLogoFromState, alt: swap.activeSwapPool?.[1]?.primary_token_symbol || "Primary token logo" })) : (React.createElement("div", { className: "w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center" }))),
                                React.createElement("div", null,
                                    React.createElement("h4", { className: ' lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium' }, swap.activeSwapPool && swap.activeSwapPool[1].primary_token_symbol))),
                            React.createElement("h3", { className: `text-right  lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium ${tentativePrimary > 50 ? 'text-red-500' : ''}` }, tentativePrimary.toFixed(4)))),
                    isAuthenticated ? React.createElement("button", { type: "button", className: `bg-[#5555FF] text-white w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 mb-4 ${parseInt(amountSecondary.toString()) === 0 ||
                            swap.loading ||
                            amountSecondary > maxBurnAllowed ||
                            tentativePrimary > 50
                            ? 'text-[#808080] cursor-not-allowed'
                            : 'bg-[#5555FF] text-white cursor-pointer'}`, style: {
                            backgroundColor: parseInt(amountSecondary.toString()) === 0 ||
                                swap.loading ||
                                amountSecondary > maxBurnAllowed ||
                                tentativePrimary > 50
                                ? '#5555FF'
                                : '', // when disabled
                        }, disabled: amountSecondary === 0 ||
                            swap.loading === true ||
                            amountSecondary > maxBurnAllowed ||
                            tentativePrimary > 50, onClick: (e) => {
                            handleSubmit(e);
                        } }, swap.loading ? (React.createElement(React.Fragment, null,
                        React.createElement(LoaderCircle, { size: 18, className: "animate animate-spin mx-auto" }),
                        " ")) : (React.createElement(React.Fragment, null, "Burn"))) : React.createElement("div", { className: "bg-balancebox text-white w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 flex items-center justify-center white-auth-btn mb-4" },
                        React.createElement(Entry, null)),
                    React.createElement("div", { className: "terms-condition-wrapper flex tems-baseline" },
                        React.createElement("span", { className: "text-[#FF37374D] mr-2 text-xl font-semibold" }, "*"),
                        React.createElement("p", { className: "lg:text-lg md:text-base sm:text-sm font-semibold md:pr-5 xs:pr-0 text-[#525252] dark:text-gray-300 md:w-9/12 xs:w-full" }, "If the transaction doesn't complete as expected, please check the redeem page to locate your tokens."))),
                React.createElement(BurnInfo, { maxBurnAllowed: maxBurnAllowed })),
            React.createElement(LoadingModal, { show: loadingModalV, message1: "Burn in Progress", message2: "Burn transaction is being processed. This may take a few moments.", setShow: setLoadingModalV }),
            React.createElement(SuccessModal, { show: successModalV, setShow: setSucessModalV }),
            React.createElement(ErrorModal, { show: errorModalV.flag, setShow: setErrorModalV, title: errorModalV.title, message: errorModalV.message }))));
};
export default BurnContent;
