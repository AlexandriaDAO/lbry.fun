import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import React, { useEffect } from "react";
const UserICPBalance = () => {
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();
    const icp = useAppSelector((state) => state.icpLedger);
    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getIcpBal(principal));
        }
    }, [isAuthenticated, principal, dispatch]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "pb-5" },
            React.createElement("div", { className: "py-4 border-b-2 border-b-[#FF9900] mb-4 px-2 md:flex md:items-center md:justify-between" },
                React.createElement("div", null,
                    React.createElement("h2", { className: "text-2xl font-bold mb-2 text-foreground" }, "Balance"),
                    React.createElement("p", { className: "text-lg text-black font-semibold text-foreground" },
                        React.createElement("span", { className: "text-[#5EBF82]" }, icp.accountBalance),
                        " ICP")),
                React.createElement("div", { className: "mt-4 md:mt-0 md:ml-6 flex items-start" },
                    React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: "flex-shrink-0 w-5 h-5 text-blue-500 mr-2" },
                        React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" })),
                    React.createElement("div", null,
                        React.createElement("p", { className: "text-sm text-gray-700 dark:text-gray-300 font-semibold" }, "Notice:"),
                        React.createElement("p", { className: "text-xs text-gray-600 dark:text-gray-400" },
                            React.createElement("strong", null, "2 ICP"),
                            " is required to create new tokens.")))))));
};
export default UserICPBalance;
