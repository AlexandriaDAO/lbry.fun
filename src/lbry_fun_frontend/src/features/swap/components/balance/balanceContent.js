import React, { useEffect } from "react";
import PrimaryBalanceCard from "./primaryBalanceCard";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
import SecondaryBalanceCard from "./secondaryBalanceCard";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";
const BalanceContent = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getAccountPrimaryBalance(principal));
            dispatch(getSecondaryBalance(principal));
        }
    }, [isAuthenticated, principal, dispatch]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement("div", { className: 'mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5' },
                React.createElement("h3", { className: "text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold" }, "Balance")),
            React.createElement("div", { className: "flex md:flex-row flex-col" },
                React.createElement(PrimaryBalanceCard, null),
                React.createElement(SecondaryBalanceCard, null)))));
};
export default BalanceContent;
