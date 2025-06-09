import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { faExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect } from "react";
// import fetchTransaction, { TransactionType } from "../../thunks/secondaryIcrc/getTransactions";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useTheme } from "@/providers/ThemeProvider";
const TransactionHistory = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const swap = useAppSelector((state) => state.swap);
    const { theme } = useTheme();
    const isDark = theme === "dark";
    useEffect(() => {
        if (!isAuthenticated || !principal)
            return;
        // dispatch(fetchTransaction(principal));
    }, [isAuthenticated, principal, dispatch]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "overflow-x-auto lg:overflow-x-auto" },
            React.createElement("table", { className: "min-w-full border-collapse" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", { className: "pb-3 pt-10 text-left" },
                            React.createElement("div", { className: 'text-xl font-medium text-foreground items-center flex' },
                                React.createElement("span", { className: 'me-2 flex' }, "Timestamp"),
                                React.createElement("div", { className: 'relative h-5 w-5 group' },
                                    React.createElement("div", { className: 'h-5 w-5 border-2 border-multycolor flex justify-center items-center rounded-full' },
                                        React.createElement(FontAwesomeIcon, { className: 'text-multycolor text-xs position-relative', icon: faExclamation }),
                                        React.createElement("span", { className: `${isDark ? 'bg-muted text-foreground' : 'bg-[#C5CFF9] text-black'} p-3 rounded-2xl absolute bottom-0 left-full ml-3 text-xs font-light w-48 z-10 opacity-0 group-hover:opacity-100 before:content-[''] before:block before:absolute before:border-t-[10px] before:border-t-transparent before:border-b-[10px] before:border-b-transparent before:border-l-[20px] before:rotate-[164deg] before:border-l-[#C5CFF9] before:top-[70%] before:-translate-y-1/2 before:left-[-15px]` }, "Transaction timestamp "))))),
                        React.createElement("th", { className: "px-6 pb-3 pt-10" },
                            React.createElement("div", { className: 'text-xl font-medium text-foreground items-center flex' },
                                React.createElement("span", { className: 'me-2 flex' }, "Type"),
                                React.createElement("div", { className: 'relative h-5 w-5 group' },
                                    React.createElement("div", { className: 'h-5 w-5 border-2 border-multycolor flex justify-center items-center rounded-full' },
                                        React.createElement(FontAwesomeIcon, { className: 'text-multycolor text-xs position-relative', icon: faExclamation }),
                                        React.createElement("span", { className: `${isDark ? 'bg-muted text-foreground' : 'bg-[#C5CFF9] text-black'} p-3 rounded-2xl absolute bottom-0 left-full ml-3 text-xs font-light w-48 z-10 opacity-0 group-hover:opacity-100 before:content-[''] before:block before:absolute before:border-t-[10px] before:border-t-transparent before:border-b-[10px] before:border-b-transparent before:border-l-[20px] before:rotate-[164deg] before:border-l-[#C5CFF9] before:top-[70%] before:-translate-y-1/2 before:left-[-15px] text-left` }, "Transaction type"))))),
                        React.createElement("th", { className: "px-6 pb-3 pt-10 text-left" },
                            React.createElement("div", { className: 'text-xl font-medium text-foreground items-center flex' },
                                React.createElement("span", { className: 'me-2 flex' }, "Amount"),
                                React.createElement("div", { className: 'relative h-5 w-5 group' },
                                    React.createElement("div", { className: 'h-5 w-5 border-2 border-multycolor flex justify-center items-center rounded-full' },
                                        React.createElement(FontAwesomeIcon, { className: 'text-multycolor text-xs position-relative', icon: faExclamation }),
                                        React.createElement("span", { className: `${isDark ? 'bg-muted text-foreground' : 'bg-[#C5CFF9] text-black'} p-3 rounded-2xl absolute bottom-0 left-full ml-3 text-xs font-light w-48 z-10 opacity-0 group-hover:opacity-100 before:content-[''] before:block before:absolute before:border-t-[10px] before:border-t-transparent before:border-b-[10px] before:border-b-transparent before:border-l-[20px] before:rotate-[164deg] before:border-l-[#C5CFF9] before:top-[70%] before:-translate-y-1/2 before:left-[-15px]` }, "Transaction amount"))))),
                        React.createElement("th", { className: "px-6 pb-3 pt-10 text-left" },
                            React.createElement("div", { className: 'text-xl font-medium text-foreground items-center flex' },
                                React.createElement("span", { className: 'me-2 flex' }, "Fee"),
                                React.createElement("div", { className: 'relative h-5 w-5 group' },
                                    React.createElement("div", { className: 'h-5 w-5 border-2 border-multycolor flex justify-center items-center rounded-full' },
                                        React.createElement(FontAwesomeIcon, { className: 'text-multycolor text-xs position-relative', icon: faExclamation }),
                                        React.createElement("span", { className: `${isDark ? 'bg-muted text-foreground' : 'bg-[#C5CFF9] text-black'} p-3 rounded-2xl absolute bottom-0 left-full ml-3 text-xs font-light w-48 z-10 opacity-0 group-hover:opacity-100 before:content-[''] before:block before:absolute before:border-t-[10px] before:border-t-transparent before:border-b-[10px] before:border-b-transparent before:border-l-[20px] before:rotate-[164deg] before:border-l-[#C5CFF9] before:top-[70%] before:-translate-y-1/2 before:left-[-15px]` }, "Transaction fee"))))),
                        React.createElement("th", { className: "px-6 pb-3 pt-10 text-left" },
                            React.createElement("div", { className: 'text-xl font-medium text-foreground items-center flex' },
                                React.createElement("span", { className: 'me-2 flex' }, "Status"),
                                React.createElement("div", { className: 'relative h-5 w-5 group' },
                                    React.createElement("div", { className: 'h-5 w-5 border-2 border-multycolor flex justify-center items-center rounded-full' },
                                        React.createElement(FontAwesomeIcon, { className: 'text-multycolor text-xs position-relative', icon: faExclamation }),
                                        React.createElement("span", { className: `${isDark ? 'bg-muted text-foreground' : 'bg-[#C5CFF9] text-black'} p-3 rounded-2xl absolute bottom-0 left-full ml-3 text-xs font-light w-48 z-10 opacity-0 group-hover:opacity-100 before:content-[''] before:block before:absolute before:border-t-[10px] before:border-t-transparent before:border-b-[10px] before:border-b-transparent before:border-l-[20px] before:rotate-[164deg] before:border-l-[#C5CFF9] before:top-[70%] before:-translate-y-1/2 before:left-[-15px]` }, "Transaction status"))))))),
                React.createElement("tbody", { className: "text-foreground text-sm font-light" })))));
};
export default TransactionHistory;
