import React, { useEffect, useState } from "react";

import { useAppSelector } from "@/store/hooks/useAppSelector";
import { _SERVICE as _SERVICESWAP } from "../../../../../../declarations/icp_swap/icp_swap.did";
import { _SERVICE as _SERVICEICPLEDGER } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";

import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import getAccountId from "@/features/icp-ledger/thunks/getAccountId";
import getIcpPrice from "../../../icp-ledger/thunks/getIcpPrice";
import { useSearchParams } from "react-router-dom";
import { Principal } from "@dfinity/principal";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory as icrc1IdlFactory } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did.js";
import type { Value as Icrc1Value } from "../../../../../../declarations/icp_ledger_canister/icp_ledger_canister.did.d.ts";
import { setActiveSwapPool } from '@/features/swap/swapSlice';

const PoolCard: React.FC = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const { loading: lbryFunLoading, error: lbryFunError } = useAppSelector((state) => state.lbryFun);
    const swap = useAppSelector((state) => state.swap);
    const activeSwapPoolFromRedux = useAppSelector((state) => state.swap.activeSwapPool);
    const icpLedger = useAppSelector((state) => state.icpLedger);
    const [searchParams] = useSearchParams();
    const idFromUrl = searchParams.get("id");

    const [primaryLogo, setPrimaryLogo] = useState<string | undefined>();
    const [secondaryLogo, setSecondaryLogo] = useState<string | undefined>();
    const [countdown, setCountdown] = useState<string>("");

    // icp ledger
    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getIcpBal(principal));
            dispatch(getAccountId(principal));
            dispatch(getIcpPrice());
        }
    }, [isAuthenticated, principal, dispatch]);
    useEffect(() => {
        if (!isAuthenticated || !principal) return;
        if (
            swap.successClaimReward === true ||
            swap.swapSuccess === true ||
            swap.burnSuccess === true ||
            swap.transferSuccess === true ||
            swap.redeeemSuccess === true ||
            icpLedger.transferSuccess === true
        ) {
            dispatch(getIcpBal(principal));
        }
    }, [isAuthenticated, principal, swap, icpLedger, dispatch]);

    useEffect(() => {
        if (activeSwapPoolFromRedux && activeSwapPoolFromRedux[1]) {
            const primaryTokenId = activeSwapPoolFromRedux[1].primary_token_id;
            const secondaryTokenId = activeSwapPoolFromRedux[1].secondary_token_id;

            const fetchLogo = async (tokenIdString: string, setLogo: React.Dispatch<React.SetStateAction<string | undefined>>) => {
                try {
                    if (!tokenIdString) return;
                    
                    const network = process.env.DFX_NETWORK || process.env.REACT_APP_DFX_NETWORK;
                    const localReplicaHost = network === 'local' ? 'http://localhost:4943' : 'https://ic0.app';

                    const agent = new HttpAgent({ host: localReplicaHost });

                    await agent.fetchRootKey().catch(err => {
                        console.warn("Unable to fetch root key. Swallowing error.", err);
                    });

                    const tokenActor = Actor.createActor(icrc1IdlFactory, {
                        agent,
                        canisterId: Principal.fromText(tokenIdString),
                    });

                    const metadata = await tokenActor.icrc1_metadata() as Array<[string, Icrc1Value]>;
                    
                    let logoEntry = metadata.find(item => item[0] === "logo");
                    if (!logoEntry) {
                        logoEntry = metadata.find(item => item[0] === "icrc1:logo");
                    }

                    if (logoEntry && logoEntry[1] && ('Text' in logoEntry[1])) {
                        let svgData = logoEntry[1].Text;
                        const duplicatedPrefix = "data:image/svg+xml;base64,data:image/svg+xml;base64,";
                        if (svgData.startsWith(duplicatedPrefix)) {
                            svgData = "data:image/svg+xml;base64," + svgData.substring(duplicatedPrefix.length);
                        }
                        setLogo(svgData);
                    } else {
                        if (tokenIdString === activeSwapPoolFromRedux?.[1]?.primary_token_id && activeSwapPoolFromRedux?.[1]?.primary_token_logo_base64) {
                            setLogo(activeSwapPoolFromRedux[1].primary_token_logo_base64);
                        } else if (tokenIdString === activeSwapPoolFromRedux?.[1]?.secondary_token_id && activeSwapPoolFromRedux?.[1]?.secondary_token_logo_base64) {
                            setLogo(activeSwapPoolFromRedux[1].secondary_token_logo_base64);
                        } else {
                            setLogo(undefined);
                        }
                    }
                } catch (error) {
                    console.error(`Failed to fetch logo for ${tokenIdString}:`, error);
                    setLogo(undefined);
                }
            };

            if (primaryTokenId && !activeSwapPoolFromRedux[1].primary_token_logo_base64) {
                fetchLogo(primaryTokenId, setPrimaryLogo);
            } else if (activeSwapPoolFromRedux[1].primary_token_logo_base64) {
                setPrimaryLogo(activeSwapPoolFromRedux[1].primary_token_logo_base64);
            }

            if (secondaryTokenId && !activeSwapPoolFromRedux[1].secondary_token_logo_base64) {
                fetchLogo(secondaryTokenId, setSecondaryLogo);
            } else if (activeSwapPoolFromRedux[1].secondary_token_logo_base64) {
                setSecondaryLogo(activeSwapPoolFromRedux[1].secondary_token_logo_base64);
            }
        } else {
            setPrimaryLogo(undefined);
            setSecondaryLogo(undefined);
        }
    }, [activeSwapPoolFromRedux]);

    useEffect(() => {
        if (activeSwapPoolFromRedux && activeSwapPoolFromRedux[1] && !activeSwapPoolFromRedux[1].isLive && activeSwapPoolFromRedux[1].created_time) {
            // created_time from the backend is in nanoseconds (as a BigInt or can be converted to one).
            const createdTimeNs = BigInt(activeSwapPoolFromRedux[1].created_time);
            const launchTimeNs = createdTimeNs + BigInt(24 * 60 * 60 * 1000 * 1000 * 1000);

            const intervalId = setInterval(() => {
                // Current time in milliseconds from local clock, convert to nanoseconds BigInt.
                const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
                const distanceNs = launchTimeNs - nowNs;

                if (distanceNs <= 0) {
                    setCountdown("Launching soon!");
                    clearInterval(intervalId);
                    return;
                }

                const oneSecondNs = BigInt(1_000_000_000);
                const oneMinuteNs = oneSecondNs * BigInt(60);
                const oneHourNs = oneMinuteNs * BigInt(60);

                const hours = distanceNs / oneHourNs;
                const minutes = (distanceNs % oneHourNs) / oneMinuteNs;
                const seconds = (distanceNs % oneMinuteNs) / oneSecondNs;
                
                const paddedHours = hours.toString().padStart(2, '0');
                const paddedMinutes = minutes.toString().padStart(2, '0');
                const paddedSeconds = seconds.toString().padStart(2, '0');

                setCountdown(`${paddedHours}h ${paddedMinutes}m ${paddedSeconds}s`);
            }, 1000);

            return () => clearInterval(intervalId);
        }
    }, [activeSwapPoolFromRedux]);

    // Skeleton Loader Component
    const PoolCardSkeleton: React.FC = () => (
        <div
            style={{ backgroundImage: 'url("images/gradient-bg.png")' }}
            className="bg-[#5555FF] text-white py-10 xxl:px-14 xl:px-12 px-5 me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 rounded-3xl xxl:py-5 xxl:px-5 mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3 animate-pulse"
        >
            <h4 className="account-box-bg text-2xl xl:text-xl font-medium mb-6 bg-gray-400 h-8 w-3/4 rounded"></h4>
            <div className="flex flex-col space-y-4">
                {[...Array(7)].map((_, index) => (
                    <div key={index} className="flex justify-between items-center">
                        <span className="font-semibold bg-gray-400 h-5 w-1/3 rounded"></span>
                        <span className="bg-gray-300 h-5 w-1/2 rounded"></span>
                    </div>
                ))}
            </div>
        </div>
    );

    // Conditional Rendering Logic
    if (idFromUrl) {
        if (lbryFunLoading && !activeSwapPoolFromRedux) {
            return (
                <div className="">
                    <PoolCardSkeleton />
                </div>
            );
        }
        if (!lbryFunLoading && lbryFunError) {
            return (
                <div className="">
                    <div
                        style={{ backgroundImage: 'url("images/gradient-bg.png")' }}
                        className="bg-[#5555FF] text-white py-10 xxl:px-14 xl:px-12 px-5 me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 rounded-3xl xxl:py-5 xxl:px-5 mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3"
                    >
                        <h4 className="account-box-bg text-2xl xl:text-xl font-medium mb-6">
                            Active Swap Pool
                        </h4>
                        <p className="text-red-300">Error loading pool information: {typeof lbryFunError === 'string' ? lbryFunError : JSON.stringify(lbryFunError)}</p>
                    </div>
                </div>
            );
        }
        if (!lbryFunLoading && !lbryFunError && !activeSwapPoolFromRedux) {
            return (
                <div className="">
                    <div
                        style={{ backgroundImage: 'url("images/gradient-bg.png")' }}
                        className="bg-[#5555FF] text-white py-10 xxl:px-14 xl:px-12 px-5 me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 rounded-3xl xxl:py-5 xxl:px-5 mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3"
                    >
                        <h4 className="account-box-bg text-2xl xl:text-xl font-medium mb-6">
                            Active Swap Pool
                        </h4>
                        <p>Pool with ID '{idFromUrl}' not found.</p>
                    </div>
                </div>
            );
        }
    }

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
                    {activeSwapPoolFromRedux && (
                        <div
                            className=""
                        >
                            <div className="flex flex-col space-y-4">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Pool ID:</span>
                                    <span className="text-white">{activeSwapPoolFromRedux[0]}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-gray-300">Primary Token:</span>
                                    <div className="flex items-center">
                                        {primaryLogo && <img src={primaryLogo} alt="Primary token logo" className="w-6 h-6 mr-2" />}
                                        <span className="text-white">
                                            {activeSwapPoolFromRedux[1].primary_token_name} ({activeSwapPoolFromRedux[1].primary_token_symbol})
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Secondary Token:</span>
                                    <div className="flex items-center">
                                        {secondaryLogo && <img src={secondaryLogo} alt="Secondary token logo" className="w-6 h-6 mr-2" />}
                                        <span className="text-white">
                                            {activeSwapPoolFromRedux[1].secondary_token_name} ({activeSwapPoolFromRedux[1].secondary_token_symbol})
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Is Live:</span>
                                    <span className="text-white">{activeSwapPoolFromRedux[1].isLive ? "Yes" : "No"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Initial Supply:</span>
                                    <span className="text-white">{activeSwapPoolFromRedux[1].initial_primary_mint}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-300">Burn Unit:</span>
                                    <span className="text-white">{activeSwapPoolFromRedux[1].initial_secondary_burn}</span>
                                </div>
                                {activeSwapPoolFromRedux[1].isLive ? (
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-300">Liquidity Provided At:</span>
                                        <span className="text-white">
                                            {activeSwapPoolFromRedux[1].liquidity_provided_at
                                                ? new Date(Number(activeSwapPoolFromRedux[1].liquidity_provided_at) / 1_000_000).toLocaleString()
                                                : "Not Provided"}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-300">Countdown to Launch:</span>
                                        <span className="text-white">{countdown || "Calculating..."}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                    )}

                </div>
            </div>
        </>
    );
};
export default PoolCard;
