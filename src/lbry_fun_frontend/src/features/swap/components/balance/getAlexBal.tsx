import React, { useEffect } from "react";
import { useAppDispatch } from '../../../../store/hooks/useAppDispatch';
import { useAppSelector } from "../../../../store/hooks/useAppSelector";

import { _SERVICE as _SERVICESWAP } from '../../../../../../declarations/icp_swap/icp_swap.did';
import { _SERVICE as _SERVICEALEX} from '../../../../../../ICRC/ICRC.did' 
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";

const GetPrimaryBal = (user: string) => {
    const dispatch = useAppDispatch();
    const primary = useAppSelector((state) => state.primary);
    const auth = useAppSelector((state) => state.auth);
    const swap = useAppSelector((state) => state.swap);

    useEffect(() => {
        if(!auth.user) return;
        dispatch(getAccountPrimaryBalance(auth.user.principal))
    }, [auth.user])
    useEffect(() => {
        if(!auth.user) return;
        if (swap.successStake === true||swap.unstakeSuccess === true||swap.burnSuccess === true ||swap.successClaimReward===true) {
            dispatch(getAccountPrimaryBalance(auth.user.principal))
        }
    }, [auth.user, swap])
    return (<div className="account-wrapper">
        Primary Balance :{primary.primaryBal}
    </div>);
};
export default GetPrimaryBal;
