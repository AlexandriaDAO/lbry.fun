import { useAppSelector } from "@/store/hooks/useAppSelector";
import React from "react";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { toast } from "sonner";
const SecondaryBalanceCard = () => {
    const dispatch = useAppDispatch();
    const icpSwap = useAppSelector(state => state.swap);
    const activeSwapPool = useAppSelector(state => state.swap.activeSwapPool);
    const auth = useAppSelector((state) => state.auth);
    const handleRefresh = () => {
        if (!auth.isAuthenticated || !auth.principal)
            return;
        dispatch(getSecondaryBalance(auth.principal));
        toast.info("Refreshing balance!");
    };
    const secondaryLogoFromState = activeSwapPool?.[1]?.secondary_token_logo_base64;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "w-full" },
            React.createElement("div", { className: 'bg-[#5555FF] py-5 px-7 me-3 rounded-3xl mb-5' },
                React.createElement("div", { className: 'flex justify-between items-center mb-3' },
                    React.createElement("div", null,
                        React.createElement("h4", { className: 'text-2xl font-medium text-white' }, activeSwapPool?.[1].secondary_token_symbol),
                        React.createElement("span", { className: 'text-sm font-regular text-lightgray ' }, activeSwapPool?.[1].secondary_token_name)),
                    React.createElement("div", null, secondaryLogoFromState ? (React.createElement("img", { src: secondaryLogoFromState, alt: activeSwapPool?.[1].secondary_token_symbol || "Secondary token logo", className: "w-12 h-12" })) : (React.createElement("div", { className: "w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center" },
                        React.createElement("span", { className: "text-xs text-gray-500" }, "No Logo"))))),
                React.createElement("div", { className: "flex justify-between items-center mb-3" },
                    React.createElement("span", { className: 'text-base text-lightgray font-medium mb-1' }, "Balance"),
                    React.createElement(FontAwesomeIcon, { className: "text-lightgray pe-2", role: "button", icon: faRotate, onClick: () => { handleRefresh(); } })),
                React.createElement("h4", { className: 'text-2xl font-medium mb-1 text-white' }, icpSwap.secondaryBalance)))));
};
export default SecondaryBalanceCard;
