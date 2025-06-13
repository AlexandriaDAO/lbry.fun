import { useAppSelector } from "@/store/hooks/useAppSelector";
import React, { useEffect, useState } from "react";
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
        if (!auth.isAuthenticated || !auth.principal) return;
        dispatch(getSecondaryBalance(auth.principal))
        toast.info("Refreshing balance!")
    }

    const secondaryLogoFromState = activeSwapPool?.[1]?.secondary_token_logo_base64;

    return (<>
        <div className="w-full"
        // className='grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1'
        >
            <div className='bg-primary py-5 px-7 me-3 rounded-3xl mb-5'>
                <div className='flex justify-between items-center mb-3'>
                    <div>
                        <h4 className='text-2xl font-medium text-primary-foreground'>{activeSwapPool?.[1].secondary_token_symbol}</h4>
                        <span className='text-sm font-regular text-primary-foreground/70'>{activeSwapPool?.[1].secondary_token_name}</span>
                    </div>
                    <div>
                        {secondaryLogoFromState ? (
                            <img src={secondaryLogoFromState} alt={activeSwapPool?.[1].secondary_token_symbol || "Secondary token logo"} className="w-12 h-12"/>
                        ) : (
                            <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                                <span className="text-xs text-secondary-foreground">No Logo</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-between items-center mb-3">
                    <span className='text-base text-primary-foreground/70 font-medium mb-1'>Balance</span>                 
                    <FontAwesomeIcon className="text-primary-foreground/70 pe-2" role="button" icon={faRotate} onClick={() => { handleRefresh() }} />
                </div>
                

                <h4 className='text-2xl font-medium mb-1 text-primary-foreground'>{icpSwap.secondaryBalance}</h4>
                {/* <span className='text-base text-lightgray font-medium'>= $10</span> */}
            </div>
        </div>
    </>)
}
export default SecondaryBalanceCard;