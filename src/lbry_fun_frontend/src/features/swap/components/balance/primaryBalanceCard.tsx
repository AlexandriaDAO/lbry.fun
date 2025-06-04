import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import React, { useEffect, useState } from "react";
import getPrimaryPrice from "../../thunks/primaryIcrc/getPrimaryPrice";
import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
import { toast } from "sonner";
import { Principal } from "@dfinity/principal";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory as icrc1IdlFactory } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did.js";
import type { Value as Icrc1Value } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";

const PrimaryBalanceCard = () => {
    const primary = useAppSelector(state => state.primary);
    const swap = useAppSelector(state => state.swap);
    const auth = useAppSelector(state => state.auth);
    const dispatch = useAppDispatch();
    const [primaryBalUsd, setPrimaryBalUsd] = useState(0);

    const handleRefresh = () => {
        if (!auth.isAuthenticated || !auth.principal) return;
        dispatch(getAccountPrimaryBalance(auth.principal))
        toast.info("Refreshing balance!")
    }
    useEffect(() => {
        dispatch(getPrimaryPrice())
    }, [dispatch])

    useEffect(() => {
        setPrimaryBalUsd(Number(primary.primaryBal) * Number(primary.primaryPriceUsd));
    }, [primary.primaryBal, primary.primaryPriceUsd])

    const primaryLogoFromState = swap.activeSwapPool?.[1]?.primary_token_logo_base64;

    return (<>
        <div className="w-full"
        // className='grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1'
        >
            <div className='bg-[#5555FF] py-5 px-7 me-3 rounded-3xl mb-5'>
                <div className='flex justify-between items-center mb-3'>
                    <div>
                        <h4 className='text-2xl font-medium text-white'>{swap.activeSwapPool&&swap.activeSwapPool[1].primary_token_name}</h4>
                        <span className='text-sm font-regular text-lightgray '>{swap.activeSwapPool&&swap.activeSwapPool[1].primary_token_symbol}</span>
                    </div>
                    <div>
                        {primaryLogoFromState ? (
                            <img src={primaryLogoFromState} alt={swap.activeSwapPool?.[1].primary_token_symbol || "Primary token logo"} className="w-12 h-12"/>
                        ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-xs text-gray-500">No Logo</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-between items-center mb-3">
                    <span className='text-base text-lightgray font-medium mb-1'>Balance</span>
                    <FontAwesomeIcon className="text-lightgray pe-2" role="button" icon={faRotate} onClick={() => { handleRefresh() }} />
                </div>
                <div className="flex text-center justify-between">

                    <h4 className='text-2xl font-medium mb-1 text-white'>{primary.primaryBal}</h4>
                    <span className='text-base text-lightgray font-medium'> ≈ $ {primaryBalUsd.toFixed(2)}</span>
                </div>
            </div>
        </div>
    </>)
}
export default PrimaryBalanceCard;