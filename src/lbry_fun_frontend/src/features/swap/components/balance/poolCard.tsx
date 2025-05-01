import React, { useEffect, useState } from "react";

import { useAppSelector } from "@/store/hooks/useAppSelector";
import { _SERVICE as _SERVICESWAP } from "../../../../../../declarations/icp_swap/icp_swap.did";
import { _SERVICE as _SERVICEICPLEDGER } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";

import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import CopyHelper from "../copyHelper";
import getAccountId from "@/features/icp-ledger/thunks/getAccountId";
import getIcpPrice from "../../../icp-ledger/thunks/getIcpPrice";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { Entry } from "@/layouts/parts/Header";
import { toast } from "sonner";
import { TokenRecordStringified } from "@/features/token/thunk/getTokenPools.thunk";
import { useSearchParams } from "react-router-dom";

const PoolCard: React.FC = () => {
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.auth);
    const { tokenPools } = useAppSelector((state) => state.lbryFun);
    const swap = useAppSelector((state) => state.swap);
    const icpLedger = useAppSelector((state) => state.icpLedger);
    const [searchParams] = useSearchParams();

    const [activeSwapPool, setActiveSwapPool] = React.useState<[string, TokenRecordStringified] | undefined>();
    const id = searchParams.get("id");


    // icp ledger
    useEffect(() => {
        if (user) {
            dispatch(getIcpBal(user.principal));
            dispatch(getAccountId(user.principal));
            dispatch(getIcpPrice());
        }
    }, [user]);
    useEffect(() => {
        if (!user) return;
        if (
            swap.successClaimReward === true ||
            swap.swapSuccess === true ||
            swap.burnSuccess === true ||
            swap.transferSuccess === true ||
            swap.redeeemSuccess === true ||
            icpLedger.transferSuccess === true
        ) {
            dispatch(getIcpBal(user.principal));
        }
    }, [user, swap, icpLedger]);


    useEffect(() => {
        const pool = tokenPools.find((tokenPool) => tokenPool[0] === id);
        setActiveSwapPool(pool);
    }, [id, tokenPools]);
    return (
        <>
            {/* <div className="grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-3 2xl:mb-12 xl:mb-10 lg:mb-7 md:mb-6 sm:mb-5"> */}
            <div className="">
                <div
                    style={{ backgroundImage: 'url("images/gradient-bg.png")' }}
                    className="bg-[#5555FF] text-white py-10 xxl:px-14 xxl:px-14 xl:px-12 px-5 me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 rounded-3xl xxl:py-5 xxl:px-5 mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3 ">
                    <h4 className="account-box-bg text-2xl xl:text-xl font-medium mb-6">
                        Active Swap Pool
                    </h4>

                    {/* Active Swap Pool Card */}
                    {activeSwapPool && (
                        // <div
                        //     style={{ backgroundImage: 'url("images/gradient-bg.png")' }}
                        //     className="bg-gray-900 text-white py-10  rounded-3xl mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3">

                        //     <div className="flex flex-col space-y-3">
                        //         <div>
                        //             <strong>Pool ID:</strong> {activeSwapPool[0]}
                        //         </div>
                        //         <div>
                        //             <strong>Primary Token:</strong> {activeSwapPool[1].primary_token_name} ({activeSwapPool[1].primary_token_symbol})
                        //         </div>
                        //         <div>
                        //             <strong>Secondary Token:</strong> {activeSwapPool[1].secondary_token_name} ({activeSwapPool[1].secondary_token_symbol})
                        //         </div>
                        //         <div>
                        //             <strong>Is Live?:</strong> {activeSwapPool[1].isLive ? "Yes" : "No"}
                        //         </div>
                        //         <div>
                        //             <strong>Initial Primary Mint:</strong> {activeSwapPool[1].initial_primary_mint}
                        //         </div>
                        //         <div>
                        //             <strong>Initial Secondary Burn:</strong> {activeSwapPool[1].initial_secondary_burn}
                        //         </div>
                        //         <div>
                        //             <strong>Liquidity Provided At:</strong> {activeSwapPool[1].liquidity_provided_at ?? "Not Provided"}
                        //         </div>
                        //     </div>
                        // </div>
                        <div
                            className=""
                        >
                            <div className="flex flex-col space-y-4">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Pool ID:</span>
                                    <span className="text-white">{activeSwapPool[0]}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Primary Token:</span>
                                    <span className="text-white">
                                        {activeSwapPool[1].primary_token_name} ({activeSwapPool[1].primary_token_symbol})
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Secondary Token:</span>
                                    <span className="text-white">
                                        {activeSwapPool[1].secondary_token_name} ({activeSwapPool[1].secondary_token_symbol})
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Is Live:</span>
                                    <span className="text-white">{activeSwapPool[1].isLive ? "Yes" : "No"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Initial Primary Mint:</span>
                                    <span className="text-white">{activeSwapPool[1].initial_primary_mint}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Initial Secondary Burn:</span>
                                    <span className="text-white">{activeSwapPool[1].initial_secondary_burn}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Liquidity Provided At:</span>
                                    <span className="text-white">
                                        {activeSwapPool[1].liquidity_provided_at
                                            ? new Date(Number(activeSwapPool[1].liquidity_provided_at) / 1_000_000).toLocaleString()
                                            : "Not Provided"}
                                    </span>
                                </div>
                            </div>
                        </div>

                    )}

                </div>
            </div>
        </>
    );
};
export default PoolCard;
