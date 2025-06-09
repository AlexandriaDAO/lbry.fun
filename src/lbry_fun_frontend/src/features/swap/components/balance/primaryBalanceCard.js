import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import React, { useEffect, useState } from "react";
import getPrimaryPrice from "../../thunks/primaryIcrc/getPrimaryPrice";
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
import { toast } from "sonner";
const PrimaryBalanceCard = () => {
    const primary = useAppSelector(state => state.primary);
    const swap = useAppSelector(state => state.swap);
    const auth = useAppSelector(state => state.auth);
    const dispatch = useAppDispatch();
    const [primaryBalUsd, setPrimaryBalUsd] = useState(0);
    const handleRefresh = () => {
        if (!auth.isAuthenticated || !auth.principal)
            return;
        dispatch(getAccountPrimaryBalance(auth.principal));
        toast.info("Refreshing balance!");
    };
    useEffect(() => {
        dispatch(getPrimaryPrice());
    }, [dispatch]);
    useEffect(() => {
        setPrimaryBalUsd(Number(primary.primaryBal) * Number(primary.primaryPriceUsd));
    }, [primary.primaryBal, primary.primaryPriceUsd]);
    const primaryLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "w-full" },
            React.createElement("div", { className: 'bg-[#5555FF] py-5 px-7 me-3 rounded-3xl mb-5' },
                React.createElement("div", { className: 'flex justify-between items-center mb-3' },
                    React.createElement("div", null,
                        React.createElement("h4", { className: 'text-2xl font-medium text-white' }, swap.activeSwapPool && swap.activeSwapPool[1].primary_token_name),
                        React.createElement("span", { className: 'text-sm font-regular text-lightgray ' }, swap.activeSwapPool && swap.activeSwapPool[1].primary_token_symbol)),
                    React.createElement("div", null, primaryLogoFromState ? (React.createElement("img", { src: primaryLogoFromState, alt: swap.activeSwapPool?.[1].primary_token_symbol || "Primary token logo", className: "w-12 h-12" })) : (React.createElement("div", { className: "w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center" },
                        React.createElement("span", { className: "text-xs text-gray-500" }, "No Logo"))))),
                React.createElement("div", { className: "flex justify-between items-center mb-3" },
                    React.createElement("span", { className: 'text-base text-lightgray font-medium mb-1' }, "Balance"),
                    React.createElement(FontAwesomeIcon, { className: "text-lightgray pe-2", role: "button", icon: faRotate, onClick: () => { handleRefresh(); } })),
                React.createElement("div", { className: "flex text-center justify-between" },
                    React.createElement("h4", { className: 'text-2xl font-medium mb-1 text-white' }, primary.primaryBal),
                    React.createElement("span", { className: 'text-base text-lightgray font-medium' },
                        " \u2248 $ ",
                        primaryBalUsd.toFixed(2)))))));
};
export default PrimaryBalanceCard;
