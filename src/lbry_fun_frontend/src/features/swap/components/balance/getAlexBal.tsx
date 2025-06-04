import React, { useEffect } from "react";
import { useAppDispatch } from '../../../../store/hooks/useAppDispatch';
import { useAppSelector } from "../../../../store/hooks/useAppSelector";
import { RootState } from "@/store";

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { _SERVICE as _SERVICEALEX} from '../../../../../../ICRC/ICRC.did' 
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";

const GetPrimaryBal = () => {
    const dispatch = useAppDispatch();
    const primary = useAppSelector((state: RootState) => state.primary);
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const swap = useAppSelector((state: RootState) => state.swap);

    useEffect(() => {
        if(!isAuthenticated || !principal) return;
        dispatch(getAccountPrimaryBalance(principal))
    }, [isAuthenticated, principal, dispatch])
    useEffect(() => {
        if(!isAuthenticated || !principal) return;
        if (swap.successStake === true||swap.unstakeSuccess === true||swap.burnSuccess === true ||swap.successClaimReward===true) {
            dispatch(getAccountPrimaryBalance(principal))
        }
    }, [isAuthenticated, principal, swap, dispatch])
    return (<div className="account-wrapper">
        Primary Balance :{primary.primaryBal}
    </div>);
};
export default GetPrimaryBal;
