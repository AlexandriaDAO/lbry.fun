import React, { useEffect, useState } from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import CopyHelper from "../copyHelper";
import getAccountId from "@/features/icp-ledger/thunks/getAccountId";
import getIcpPrice from "../../../icp-ledger/thunks/getIcpPrice";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { Entry } from "@/layouts/parts/Header";
import { toast } from "sonner";
import PoolCard from "./poolCard";
const ICP_PRICE_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes (should match thunk)
const AccountCards = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const swap = useAppSelector((state) => state.swap);
    const { icpPrice, icpPriceTimestamp, accountId: icpLedgerAccountId, // Renamed to avoid conflict
    accountBalance: icpLedgerAccountBalance, // Renamed
    accountBalanceUSD: icpLedgerAccountBalanceUSD, // Renamed
    transferSuccess: icpLedgerTransferSuccess // Renamed
     } = useAppSelector((state) => state.icpLedger);
    const [formattedPrincipal, setFormattedPrincipal] = useState("");
    const [formattedAccountId, setFormattedAccountId] = useState("");
    const handleRefresh = () => {
        if (!isAuthenticated || !principal)
            return;
        dispatch(getIcpBal(principal));
        dispatch(getIcpPrice());
        toast.info("Refreshing balance!");
    };
    // icp ledger
    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getIcpBal(principal));
            dispatch(getAccountId(principal));
            // Check if ICP price is needed
            if (!icpPrice || !icpPriceTimestamp || (Date.now() - icpPriceTimestamp > ICP_PRICE_STALE_THRESHOLD_MS)) {
                console.log("AccountCards: dispatching getIcpPrice due to stale/missing data.");
                dispatch(getIcpPrice());
            }
            else {
                console.log("AccountCards: using existing fresh ICP price from store.");
            }
        }
    }, [isAuthenticated, principal, dispatch, icpPrice, icpPriceTimestamp]);
    useEffect(() => {
        if (!isAuthenticated || !principal)
            return;
        if (swap.successClaimReward === true ||
            swap.swapSuccess === true ||
            swap.burnSuccess === true ||
            swap.transferSuccess === true ||
            swap.redeeemSuccess === true ||
            icpLedgerTransferSuccess === true // Used renamed variable
        ) {
            dispatch(getIcpBal(principal));
        }
    }, [isAuthenticated, principal, swap, icpLedgerTransferSuccess, dispatch]); // Used renamed variable
    //style
    useEffect(() => {
        if (!isAuthenticated || !principal || !icpLedgerAccountId)
            return;
        const handleResize = () => {
            if (window.innerWidth < 1000) {
                setFormattedPrincipal(principal.slice(0, 3) + "..." + principal.slice(-3));
                setFormattedAccountId(icpLedgerAccountId.slice(0, 3) + "..." + icpLedgerAccountId.slice(-3));
            }
            else {
                setFormattedPrincipal(principal.slice(0, 5) + "..." + principal.slice(-20));
                setFormattedAccountId(icpLedgerAccountId.slice(0, 5) + "..." + icpLedgerAccountId.slice(-20));
            }
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [isAuthenticated, principal, icpLedgerAccountId, dispatch]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-3 2xl:mb-12 xl:mb-10 lg:mb-7 md:mb-6 sm:mb-5" },
            React.createElement("div", { style: { backgroundImage: 'url("images/gradient-bg.png")' }, className: "bg-[#5555FF] text-white py-10 xxl:px-14 xxl:px-14 xl:px-12 px-5 me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 rounded-3xl xxl:py-5 xxl:px-5 mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3 " },
                React.createElement("h4", { className: "account-box-bg text-2xl xl:text-xl font-medium mb-3  2xl:mb-3  xl:mb-3" }, "Principal Account"),
                isAuthenticated && principal ? (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "md:mb-20 sm:mb-16 xs:mb-10" },
                        React.createElement("div", { className: "flex justify-between mb-3 xxl:mb-3" },
                            React.createElement("div", null,
                                React.createElement("strong", { className: "text-xl font-medium me-3 xxl:text-xl xxl:me-3" }, formattedPrincipal),
                                React.createElement("span", { className: "text-base text-multycolor font-medium xxl:text-base" }, "(Connected)")),
                            principal && React.createElement(CopyHelper, { account: principal })),
                        React.createElement("h4", { className: "text-2xl xl:text-xl font-medium mb-3  2xl:mb-3  xl:mb-3" }, "Account Id:"),
                        React.createElement("div", { className: "flex justify-between mb-3 xxl:mb-3" },
                            React.createElement("div", { className: "break-all " },
                                React.createElement("strong", { className: "text-xl font-medium me-3 xxl:text-xl xxl:me-3" }, formattedAccountId),
                                React.createElement("span", { className: "text-base text-multycolor font-medium xxl:text-base" }, "(Connected)")),
                            icpLedgerAccountId && React.createElement(CopyHelper, { account: icpLedgerAccountId }))),
                    React.createElement("h4", { className: "text-2xl 2xl:text-2xl font-medium mb-3 flex text-center justify-between" },
                        "Estimated Balance ",
                        React.createElement(FontAwesomeIcon, { role: "button", icon: faRotate, onClick: () => { handleRefresh(); } })),
                    React.createElement("div", { className: "flex text-center justify-between" },
                        React.createElement("div", null,
                            React.createElement("h4", { className: "text-2xl 2xl:text-2xl font-medium mb-3 " },
                                "\u2248 ICP ",
                                icpLedgerAccountBalance)),
                        React.createElement("div", { className: "mb-3 xxl:mb-3" },
                            React.createElement("h4", { className: "text-2xl 2xl:text-2xl font-medium mb-3 text-[#FF9900]" },
                                "\u2248 $ ",
                                icpLedgerAccountBalanceUSD))))) : (React.createElement("div", { className: "mb-20 xxl:mb-20" },
                    React.createElement("div", { className: "flex justify-between mb-3 xxl:mb-3 text-white white-auth-btn" },
                        React.createElement(Entry, null))))),
            React.createElement(PoolCard, null))));
};
export default AccountCards;
