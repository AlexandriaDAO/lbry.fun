import React, { useState } from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import CopyHelper from "../copyHelper";
import { options as staticOptions } from "@/utils/utils";
import QRCode from "react-qr-code";
const ReceiveContent = () => {
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const swap = useAppSelector((state) => state.swap);
    const [isOpen, setIsOpen] = useState(false);
    const [networkOpen, setNetworkOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState("Select an option");
    const [selectedNetwork, setSelectedNetwork] = useState("ICP(Internet Computer)");
    const [selectedImage, setSelectedImage] = useState("");
    const [selectedNetworkImage, setSelectedNetworkImage] = useState("images/icp-logo.png");
    const [fee, setFee] = useState();
    const networkOptions = [
        { value: "ICP", label: "ICP(Internet Computer)", img: "images/icp-logo.png" },
    ];
    const primaryLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;
    const secondaryLogoFromState = swap.activeSwapPool?.[1]?.secondary_token_logo_base64;
    const dynamicOptions = React.useMemo(() => {
        const baseOptions = [
            { value: "ICP", label: "ICP", img: "images/8-logo.png", fee: staticOptions.find(o => o.label === "ICP")?.fee },
        ];
        if (swap.activeSwapPool && swap.activeSwapPool[1]) {
            baseOptions.push({
                value: "PRIMARY",
                label: swap.activeSwapPool[1].primary_token_symbol || "Primary",
                img: primaryLogoFromState,
                fee: staticOptions.find(o => o.label === "ALEX")?.fee
            });
            baseOptions.push({
                value: "SECONDARY",
                label: swap.activeSwapPool[1].secondary_token_symbol || "Secondary",
                img: secondaryLogoFromState,
                fee: staticOptions.find(o => o.label === "Secondary")?.fee
            });
        }
        return baseOptions;
    }, [swap.activeSwapPool, primaryLogoFromState, secondaryLogoFromState, staticOptions]);
    const handleSelect = (option) => {
        setSelectedOption(option.label);
        setFee(option.fee);
        setIsOpen(false);
        setSelectedImage(option.img);
    };
    const handleNetworkSelect = (option) => {
        setSelectedNetwork(option.label);
        setNetworkOpen(false);
        setSelectedNetworkImage(option.img);
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement("div", { className: 'mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5' },
                React.createElement("h3", { className: "text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold" }, "Receive")),
            React.createElement("div", { className: 'grid grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-12' },
                React.createElement("div", { className: 'me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 mb-3 2xl:mb-0 xl:mb-0 lg:mb-3 md:mb-3 sm:mb-3' },
                    React.createElement("div", { className: 'flex items-center mb-3' },
                        React.createElement("span", { className: 'flex lg:text-2xl md:text-xl sm:text-lg xs:text-base font-bold w-circlewidth h-circleheight bg-balancebox rounded-full text-white justify-center items-center me-3' }, "1"),
                        React.createElement("strong", { className: 'lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium' }, "Choose token")),
                    React.createElement("div", { className: "relative inline-block w-full mb-4" },
                        React.createElement("div", { onClick: () => setIsOpen(!isOpen), className: "flex justify-between items-center border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-800 py-4 px-5 lg:text-2xl md:text-xl sm:text-lg xs:text-base font-semibold cursor-pointer" },
                            React.createElement("div", { className: 'flex items-center' },
                                selectedImage ? React.createElement("img", { className: 'h-5 w-5 me-3', src: selectedImage, alt: "Selected" }) : null,
                                React.createElement("span", { className: 'lg:text-xl md:text-lg sm:text-sm font-medium text-black dark:text-white' }, selectedOption)),
                            React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
                                React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M19 9l-7 7-7-7" }))),
                        isOpen && (React.createElement("div", { className: "absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg" }, dynamicOptions.map((option, index) => {
                            return (React.createElement("div", { key: index, onClick: () => handleSelect(option), className: "flex items-center py-2 px-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer dark:text-white" },
                                option.img ? (React.createElement("img", { src: option.img, alt: option.label, className: "h-5 w-5 mr-3" })) : (React.createElement("div", { className: "w-5 h-5 mr-3 bg-gray-200 rounded-full flex items-center justify-center" })),
                                React.createElement("span", null, option.label)));
                        })))),
                    React.createElement("div", { className: 'flex items-center mb-4' },
                        React.createElement("span", { className: 'flex lg:text-2xl md:text-xl sm:text-lg xs:text-base font-bold w-circlewidth h-circleheight bg-balancebox rounded-full text-white justify-center items-center me-3' }, "2"),
                        React.createElement("strong", { className: 'lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium' }, "Choose network")),
                    React.createElement("div", { className: "relative inline-block w-full mb-4" },
                        React.createElement("div", { onClick: () => setNetworkOpen(!networkOpen), className: "flex justify-between items-center border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-800 py-4 px-5 lg:text-2xl md:text-xl sm:text-lg xs:text-base font-semibold cursor-pointer" },
                            React.createElement("div", { className: 'flex items-center' },
                                React.createElement("span", { className: 'lg:text-xl md:text-lg sm:text-sm font-medium text-black dark:text-white' }, selectedNetwork)),
                            React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
                                React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M19 9l-7 7-7-7" }))),
                        networkOpen && (React.createElement("div", { className: "absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg" }, networkOptions.map((option, index) => (React.createElement("div", { key: index, onClick: () => handleNetworkSelect(option), className: "flex items-center py-2 px-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer dark:text-white" },
                            React.createElement("img", { src: option.img, alt: option.label, className: "h-5 w-5 mr-3" }),
                            React.createElement("span", null, option.label))))))),
                    React.createElement("div", { className: 'flex items-center mb-7' },
                        React.createElement("span", { className: 'flex lg:text-2xl md:text-xl sm:text-lg xs:text-base font-bold w-circlewidth h-circleheight bg-balancebox rounded-full text-white justify-center items-center me-3' }, "3"),
                        React.createElement("strong", { className: 'lg:text-2xl md:text-xl sm:text-lg xs:text-base font-medium' }, "Your Address")),
                    React.createElement("div", { className: "flex items-center" },
                        React.createElement("div", { style: { height: "120px", marginRight: "20px", width: "120px", background: "white", padding: "8px", borderRadius: "4px" } }, isAuthenticated && principal && React.createElement(QRCode, { size: 256, style: { height: "auto", maxWidth: "100%", width: "100%" }, value: principal, viewBox: `0 0 256 256` })),
                        React.createElement("div", { className: "w-[calc(100%-140px)]" },
                            React.createElement("label", { className: 'mb-2 text-xl font-medium dark:text-white' }, "ICP Address"),
                            React.createElement("div", { className: 'border border-gray-400 dark:border-gray-600 py-5 px-5 rounded-borderbox flex items-center justify-between bg-white dark:bg-gray-800' },
                                React.createElement("p", { className: 'truncate text-lg font-medium text-radiocolor dark:text-gray-300 me-5' }, principal ? principal.toString() : ""),
                                React.createElement("div", null, isAuthenticated && principal && React.createElement(CopyHelper, { account: principal })))))),
                React.createElement("div", { className: 'ms-0 2xl:ms-3 xl:ms-3 lg:ms-3 md:ms-3 sm:ms-0' },
                    React.createElement("div", { className: 'border border-gray-400 dark:border-gray-600 text-white py-5 px-5 rounded-2xl bg-white dark:bg-gray-800' },
                        React.createElement("ul", { className: 'ps-0' },
                            React.createElement("li", { className: 'flex justify-between mb-5' },
                                React.createElement("strong", { className: 'text-lg font-medium me-1 text-radiocolor dark:text-gray-300' }, "Minimum deposit amount"),
                                React.createElement("span", { className: 'text-lg font-medium text-radiocolor dark:text-gray-300' },
                                    "0.001 ",
                                    selectedOption)),
                            React.createElement("li", { className: 'flex justify-between mb-5' },
                                React.createElement("strong", { className: 'text-lg font-medium me-1 text-radiocolor dark:text-gray-300' }, "Network Fees:"),
                                React.createElement("span", { className: 'text-lg font-medium text-radiocolor dark:text-gray-300' },
                                    React.createElement("span", { className: 'text-multycolor' }, fee),
                                    " ",
                                    selectedOption)),
                            React.createElement("li", null,
                                React.createElement("p", { className: 'text-lg font-medium text-radiocolor dark:text-gray-300' }, "Do not deposit assets other than those listed as this may result in irretrievability of deposited assets.")))))))));
};
export default ReceiveContent;
