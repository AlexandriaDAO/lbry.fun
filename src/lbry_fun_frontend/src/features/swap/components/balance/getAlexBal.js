import React, { useEffect } from "react";
import { useAppDispatch } from '../../../../store/hooks/useAppDispatch';
import { useAppSelector } from "../../../../store/hooks/useAppSelector";
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
const GetPrimaryBal = () => {
    const dispatch = useAppDispatch();
    const primary = useAppSelector((state) => state.primary);
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const swap = useAppSelector((state) => state.swap);
    useEffect(() => {
        if (!isAuthenticated || !principal)
            return;
        dispatch(getAccountPrimaryBalance(principal));
    }, [isAuthenticated, principal, dispatch]);
    useEffect(() => {
        if (!isAuthenticated || !principal)
            return;
        if (swap.successStake === true || swap.unstakeSuccess === true || swap.burnSuccess === true || swap.successClaimReward === true) {
            dispatch(getAccountPrimaryBalance(principal));
        }
    }, [isAuthenticated, principal, swap, dispatch]);
    return (React.createElement("div", { className: "account-wrapper" },
        "Primary Balance :",
        primary.primaryBal));
};
export default GetPrimaryBal;
