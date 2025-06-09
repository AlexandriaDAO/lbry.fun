import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import transferICP from "@/features/icp-ledger/thunks/transferICP";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import transferPrimary from "../../thunks/primaryIcrc/transferPrimary";
import transferSecondary from "../../thunks/secondaryIcrc/transferSecondary";
import { icpLedgerFlagHandler } from "@/features/icp-ledger/icpLedgerSlice";
import { flagHandler } from "../../swapSlice";
import { icp_fee, options as staticOptions } from "@/utils/utils";
import { LoaderCircle } from "lucide-react";
import LoadingModal from "../loadingModal";
import SuccessModal from "../successModal";
import { primaryFlagHandler } from "../../primarySlice";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";
import ErrorModal from "../errorModal";
import { Entry } from "@/layouts/parts/Header";
import { Principal } from "@dfinity/principal";
const SendContent = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const icpLedger = useAppSelector((state) => state.icpLedger);
    const primary = useAppSelector((state) => state.primary);
    const swap = useAppSelector((state) => state.swap);
    const [isOpen, setIsOpen] = useState(false);
    const [loadingModalV, setLoadingModalV] = useState(false);
    const [successModalV, setSucessModalV] = useState(false);
    const [errorModalV, setErrorModalV] = useState(false);
    const [selectedOption, setSelectedOption] = useState("Select an option");
    const [selectedImage, setSelectedImage] = useState("");
    const [availableBalance, setAvailableBalnce] = useState("");
    const [destinationPrincipal, setDestinationPrincipal] = useState("");
    const [principalError, setPrincipalError] = useState("");
    const [amount, setAmount] = useState("0");
    const [fee, setFee] = useState();
    const validatePrincipal = (principalString) => {
        try {
            if (!principalString) {
                setPrincipalError("Principal ID is required");
                return false;
            }
            Principal.fromText(principalString);
            setPrincipalError("");
            return true;
        }
        catch (error) {
            setPrincipalError("Invalid Principal ID format");
            return false;
        }
    };
    const primaryLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;
    const secondaryLogoFromState = swap.activeSwapPool?.[1]?.secondary_token_logo_base64;
    const dynamicSendOptions = React.useMemo(() => {
        const baseOptions = [
            { value: "ICP", label: "ICP", img: "images/8-logo.png", fee: staticOptions.find(o => o.label === "ICP")?.fee },
        ];
        if (swap.activeSwapPool && swap.activeSwapPool[1]) {
            const primarySymbol = swap.activeSwapPool[1].primary_token_symbol || "PRIMARY";
            const secondarySymbol = swap.activeSwapPool[1].secondary_token_symbol || "SECONDARY";
            baseOptions.push({
                value: primarySymbol,
                label: primarySymbol,
                img: primaryLogoFromState,
                fee: staticOptions.find(o => o.label === "ALEX")?.fee
            });
            baseOptions.push({
                value: secondarySymbol,
                label: secondarySymbol,
                img: secondaryLogoFromState,
                fee: staticOptions.find(o => o.label === "Secondary")?.fee
            });
        }
        return baseOptions;
    }, [swap.activeSwapPool, primaryLogoFromState, secondaryLogoFromState, staticOptions]);
    const handleAmountChange = (e) => {
        if (Number(e.target.value) >= 0) {
            setAmount(e.target.value);
        }
    };
    const handleDestinationPrincipalChange = (e) => {
        const value = e.target.value;
        setDestinationPrincipal(value);
        validatePrincipal(value);
    };
    const handleSelect = (option) => {
        setFee(option.fee);
        setSelectedOption(option.label);
        setIsOpen(false);
        setSelectedImage(option.img);
    };
    const handleMax = () => {
        if (selectedOption === "ICP") {
            const userBal = Math.max(0, Number(icpLedger.accountBalance) - 1 * icp_fee).toFixed(4);
            setAmount(userBal);
        }
        else if (selectedOption === (swap.activeSwapPool?.[1]?.primary_token_symbol || "PRIMARY")) {
            const userBal = Math.max(0, Number(primary.primaryBal) - (Number(primary.primaryFee) * 1)).toFixed(4);
            setAmount(userBal);
        }
        else if (selectedOption === (swap.activeSwapPool?.[1]?.secondary_token_symbol || "SECONDARY")) {
            const userBal = Math.max(0, Number(swap.secondaryBalance) - (Number(swap.secondaryFee) * 1)).toFixed(4);
            setAmount(userBal);
        }
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validatePrincipal(destinationPrincipal)) {
            return;
        }
        if (selectedOption === "ICP") {
            dispatch(transferICP({ amount, destination: destinationPrincipal, accountType: "principal" }));
        }
        else if (selectedOption === (swap.activeSwapPool?.[1]?.primary_token_symbol || "PRIMARY")) {
            dispatch(transferPrimary({ amount, destination: destinationPrincipal }));
        }
        else if (selectedOption === (swap.activeSwapPool?.[1]?.secondary_token_symbol || "SECONDARY")) {
            dispatch(transferSecondary({ amount, destination: destinationPrincipal }));
        }
        setLoadingModalV(true);
    };
    useEffect(() => {
        if (selectedOption === "ICP") {
            setAvailableBalnce(icpLedger.accountBalance + " " + selectedOption);
        }
        else if (selectedOption === (swap.activeSwapPool?.[1]?.primary_token_symbol || "PRIMARY")) {
            setAvailableBalnce(primary.primaryBal + " " + (swap.activeSwapPool?.[1]?.primary_token_symbol || "PRIMARY"));
        }
        else if (selectedOption === (swap.activeSwapPool?.[1]?.secondary_token_symbol || "SECONDARY")) {
            setAvailableBalnce(swap.secondaryBalance + " " + (swap.activeSwapPool?.[1]?.secondary_token_symbol || "SECONDARY"));
        }
        else if (selectedOption === "Select an option") {
            setAvailableBalnce("");
        }
    }, [selectedOption, icpLedger.accountBalance, primary.primaryBal, swap.secondaryBalance, swap.activeSwapPool]);
    useEffect(() => {
        if (!isAuthenticated || !principal)
            return;
        if (icpLedger.transferSuccess === true) {
            setLoadingModalV(false);
            setSucessModalV(true);
            dispatch(getIcpBal(principal));
            dispatch(icpLedgerFlagHandler());
        }
        else if (primary.transferSuccess === true) {
            setLoadingModalV(false);
            setSucessModalV(true);
            dispatch(getAccountPrimaryBalance(principal));
            dispatch((primaryFlagHandler()));
        }
        else if (swap.transferSuccess === true) {
            setLoadingModalV(false);
            setSucessModalV(true);
            dispatch(getSecondaryBalance(principal));
            dispatch((flagHandler()));
        }
        else if (swap.error || primary.error || icpLedger.error) {
            setLoadingModalV(false);
            setErrorModalV(true);
            dispatch(flagHandler());
            dispatch(primaryFlagHandler());
            dispatch(icpLedgerFlagHandler());
        }
    }, [isAuthenticated, principal, icpLedger, swap, primary, dispatch]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement("div", { className: 'mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5' },
                React.createElement("h3", { className: "text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold" }, "Send")),
            React.createElement("div", { className: 'grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-12' },
                React.createElement("div", { className: 'me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 mb-3 2xl:mb-0 xl:mb-0 lg:mb-3 md:mb-3 sm:mb-3' },
                    React.createElement("div", { className: 'flex items-center mb-3' },
                        React.createElement("span", { className: 'flex text-2xl font-bold w-circlewidth h-circleheight bg-balancebox rounded-full text-white justify-center items-center me-3' }, "1"),
                        React.createElement("strong", { className: 'lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium' }, "Choose token")),
                    React.createElement("div", { className: "relative inline-block w-full mb-4" },
                        React.createElement("div", { onClick: () => setIsOpen(!isOpen), className: "flex justify-between items-center border border-gray-300 dark:border-gray-700 rounded-full bg-white dark:bg-gray-800 py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-3 2xl:px-5 xl:px-5 lg:px-4 md:px-3 sm:px-3 text-2xl font-semibold cursor-pointer" },
                            React.createElement("div", { className: 'flex items-center' },
                                selectedImage ?
                                    React.createElement("img", { className: 'h-5 w-5 me-3', src: selectedImage, alt: selectedOption }) :
                                    (selectedOption !== "Select an option" && React.createElement("div", { className: 'h-5 w-5 me-3 bg-gray-200 rounded-full' })),
                                React.createElement("span", { className: 'lg:text-xl md:text-lg xs:text-base font-medium text-black dark:text-gray-200' }, selectedOption)),
                            React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6 dark:text-gray-400", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
                                React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M19 9l-7 7-7-7" }))),
                        isOpen && (React.createElement("div", { className: "absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg" }, dynamicSendOptions.map((option, index) => {
                            return (React.createElement("div", { key: index, onClick: () => handleSelect(option), className: "flex items-center py-2 px-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer dark:text-gray-200" },
                                option.img ? (React.createElement("img", { src: option.img, alt: option.label, className: "h-5 w-5 mr-3" })) : (React.createElement("div", { className: "w-5 h-5 mr-3 bg-gray-200 rounded-full flex items-center justify-center" })),
                                React.createElement("span", null, option.label)));
                        })))),
                    React.createElement("div", { className: 'flex items-center mb-4' },
                        React.createElement("span", { className: 'flex text-2xl font-bold w-circlewidth h-circleheight bg-balancebox rounded-full text-white justify-center items-center me-3' }, "2"),
                        React.createElement("strong", { className: 'lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium dark:text-gray-200' }, "Enter the Principal ID")),
                    React.createElement("div", { className: 'border bg-white dark:bg-gray-800 dark:border-gray-700 py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-3 2xl:px-5 xl:px-5 lg:px-4 md:px-3 sm:px-3 rounded-full mb-4' },
                        React.createElement("input", { className: `text-multygray dark:text-gray-300 bg-transparent text-xl font-medium placeholder-multygray dark:placeholder-gray-400 focus:outline-none focus:border-transparent w-full ${principalError ? 'border-red-500' : ''}`, type: 'text', onChange: (e) => { handleDestinationPrincipalChange(e); }, value: destinationPrincipal, placeholder: "Enter Principal ID" })),
                    principalError && (React.createElement("div", { className: "text-red-500 text-sm mb-4 px-5" }, principalError)),
                    React.createElement("div", { className: 'flex items-center mb-4' },
                        React.createElement("span", { className: 'flex text-2xl font-bold w-circlewidth h-circleheight bg-balancebox rounded-full text-white justify-center items-center me-3' }, "3"),
                        React.createElement("strong", { className: 'lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium dark:text-gray-200' }, "Enter the amount")),
                    React.createElement("div", { className: 'border bg-white dark:bg-gray-800 dark:border-gray-700 py-5 px-5 rounded-borderbox mb-7' },
                        React.createElement("div", { className: 'mb-3 w-full' },
                            React.createElement("div", { className: 'flex justify-between mb-3' },
                                React.createElement("h4", { className: 'lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium text-darkgray dark:text-gray-300' }, "Amount"),
                                React.createElement("input", { className: 'text-darkgray dark:text-gray-200 mr-[-10px] text-right bg-transparent lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium placeholder-darkgray dark:placeholder-gray-400 focus:outline-none focus:border-transparent w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none', type: 'number', onChange: (e) => { handleAmountChange(e); }, value: amount })),
                            React.createElement("div", { className: 'flex justify-between' },
                                React.createElement("div", { className: 'flex items-center' },
                                    React.createElement("strong", { className: 'text-base text-multygray dark:text-gray-300 font-medium me-2' },
                                        "Available Balance:",
                                        React.createElement("span", { className: 'text-base text-darkgray dark:text-gray-200 ms-2' }, availableBalance)),
                                    selectedOption === "ICP" && React.createElement("img", { className: 'w-5 h-5', src: "images/8-logo.png", alt: "icp" }),
                                    selectedOption === (swap.activeSwapPool?.[1]?.primary_token_symbol || "PRIMARY") &&
                                        (primaryLogoFromState ?
                                            React.createElement("img", { className: 'w-5 h-5', src: primaryLogoFromState, alt: "primary token" }) :
                                            React.createElement("div", { className: 'w-5 h-5 bg-gray-200 rounded-full' })),
                                    selectedOption === (swap.activeSwapPool?.[1]?.secondary_token_symbol || "SECONDARY") &&
                                        (secondaryLogoFromState ?
                                            React.createElement("img", { className: 'w-5 h-5', src: secondaryLogoFromState, alt: "secondary token" }) :
                                            React.createElement("div", { className: 'w-5 h-5 bg-gray-200 rounded-full' }))),
                                React.createElement(Link, { role: "button", to: "", className: 'text-[#A7B1D7] dark:text-blue-400 underline text-base font-medium', onClick: () => { handleMax(); } }, "Max")))),
                    isAuthenticated ? React.createElement("button", { type: "button", className: `w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2
                            ${parseFloat(amount) === 0 || icpLedger.loading || primary.loading || swap.loading ? 'text-[#808080] cursor-not-allowed' : 'bg-balancebox text-white cursor-pointer'}`, style: {
                            backgroundColor: parseFloat(amount) === 0 || icpLedger.loading || primary.loading || swap.loading ? '#525252' : '',
                        }, disabled: parseFloat(amount) === 0 || icpLedger.loading || primary.loading || swap.loading, onClick: (e) => {
                            handleSubmit(e);
                        } }, (icpLedger.loading || primary.loading || swap.loading) ? (React.createElement(React.Fragment, null,
                        React.createElement(LoaderCircle, { size: 18, className: "animate animate-spin mx-auto" }),
                        " ")) : (React.createElement(React.Fragment, null, "Send"))) : React.createElement("div", { className: "bg-balancebox text-white w-full rounded-full text-base 2xl:text-2xl xl:text-xl lg:text-xl md:text-lg sm:text-base font-semibold py-2 2xl:py-4 xl:py-4 lg:py-3 md:py-3 sm:py-2 px-2 2xl:px-4 xl:px-4 lg:px-3 md:px-3 sm:px-2 flex items-center justify-center white-auth-btn" },
                        React.createElement(Entry, null))),
                React.createElement("div", { className: 'ms-0 2xl:ms-3 xl:ms-3 lg:ms-3 md:ms-3 sm:ms-0' }, selectedOption !== "Select an option" ? React.createElement("div", { className: 'border border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-800 py-5 px-5 rounded-2xl' },
                    React.createElement("ul", { className: 'ps-0 pb-7' },
                        React.createElement("li", { className: 'flex justify-between mb-5' },
                            React.createElement("strong", { className: 'text-lg font-semibold me-1 text-radiocolor dark:text-gray-200' }, "Send"),
                            React.createElement("span", { className: 'text-lg font-semibold text-radiocolor dark:text-gray-200' }, amount)),
                        React.createElement("li", { className: 'flex justify-between mb-5' },
                            React.createElement("strong", { className: 'text-lg font-semibold me-5 text-radiocolor dark:text-gray-200 whitespace-nowrap' }, "Send to"),
                            React.createElement("h6", { className: 'truncate text-lg font-semibold text-radiocolor dark:text-gray-200' }, destinationPrincipal)),
                        React.createElement("li", { className: 'flex justify-between mb-5' },
                            React.createElement("strong", { className: 'text-lg font-semibold me-1 text-radiocolor dark:text-gray-200' }, "Network Fees"),
                            React.createElement("span", { className: 'text-lg font-semibold text-radiocolor dark:text-gray-200' },
                                React.createElement("span", { className: 'text-multycolor dark:text-blue-400' }, fee),
                                " ",
                                selectedOption)))) : React.createElement(React.Fragment, null))),
            React.createElement(LoadingModal, { show: loadingModalV, message1: "Transfer in Progress", message2: "Your transaction is being processed. This may take a few moments.", setShow: setLoadingModalV }),
            React.createElement(SuccessModal, { show: successModalV, setShow: setSucessModalV }),
            React.createElement(ErrorModal, { show: errorModalV, setShow: setErrorModalV, title: swap.error?.title ||
                    (primary.error && typeof primary.error === 'object' && primary.error.title ? primary.error.title : null) ||
                    (icpLedger.error && typeof icpLedger.error === 'object' && icpLedger.error.title ? icpLedger.error.title : null) ||
                    "Error", message: swap.error?.message ||
                    (primary.error && typeof primary.error === 'object' && primary.error.message ? primary.error.message : typeof primary.error === 'string' ? primary.error : null) ||
                    (icpLedger.error && typeof icpLedger.error === 'object' && icpLedger.error.message ? icpLedger.error.message : typeof icpLedger.error === 'string' ? icpLedger.error : null) ||
                    "An unknown error occurred." }))));
};
export default SendContent;
