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
import { TokenConversionService } from "@/utils/TokenConversionService";
import { RootState } from "@/store";
import { LAUNCH_PERIOD_NANOS } from "@/constants/launchPeriod";

const PoolCard: React.FC = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state) => state.auth);
    const { loading: lbryFunLoading, error: lbryFunError } = useAppSelector((state) => state.lbryFun);
    const swap = useAppSelector((state) => state.swap);
    const activeSwapPoolFromRedux = useAppSelector((state) => state.swap.activeSwapPool);
    const icpLedger = useAppSelector((state) => state.icpLedger);
    const tokenomics = useAppSelector((state: RootState) => state.tokenomics);
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
            // ICP price is already fetched in useSwapDataLoader
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
            const launchTimeNs = createdTimeNs + LAUNCH_PERIOD_NANOS;

            const intervalId = setInterval(() => {
                // Current time in milliseconds from local clock, convert to nanoseconds BigInt.
                const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
                const distanceNs = launchTimeNs - nowNs;

                if (distanceNs <= 0) {
                    // Time has passed, clear the countdown
                    setCountdown("");
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
        } else {
            // Clear countdown if token is live or no data
            setCountdown("");
        }
    }, [activeSwapPoolFromRedux]);

    // Skeleton Loader Component
    const PoolCardSkeleton: React.FC = () => (
        <div className="terminal-card text-gray-200 animate-pulse">
            <div className="terminal-header bg-muted h-8 w-3/4 rounded mb-6"></div>
            <div className="space-y-4">
                {[...Array(4)].map((_, index) => (
                    <div key={index} className="data-row">
                        <div className="bg-muted h-5 w-1/3 rounded"></div>
                        <div className="bg-muted/70 h-5 w-1/2 rounded"></div>
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
                    <div className="terminal-card text-gray-200">
                        <h4 className="terminal-header">ACTIVE_SWAP_POOL</h4>
                        <p className="text-pink-400 font-mono">ERROR: {typeof lbryFunError === 'string' ? lbryFunError : JSON.stringify(lbryFunError)}</p>
                    </div>
                </div>
            );
        }
        if (!lbryFunLoading && !lbryFunError && !activeSwapPoolFromRedux) {
            return (
                <div className="">
                    <div className="terminal-card text-gray-200">
                        <h4 className="terminal-header">ACTIVE_SWAP_POOL</h4>
                        <p className="font-mono text-pink-500">POOL_NOT_FOUND: {idFromUrl}</p>
                    </div>
                </div>
            );
        }
    }

    return (
        <>
            <div className="">
                <div className="terminal-card text-gray-200">
                    <h4 className="terminal-header">
                        <span className="terminal-prompt">&gt;</span> ACTIVE_SWAP_POOL
                    </h4>

                    {/* Active Swap Pool Card */}
                    {activeSwapPoolFromRedux && (
                        <>
                            <div className="md:mb-20 sm:mb-16 xs:mb-10 ">
                                <div className="data-row mb-4 pb-4 border-b border-pink-900/20">
                                    <span className="data-label">pool_id:</span>
                                    <span className="font-mono text-sm text-gray-400">{activeSwapPoolFromRedux[0]}</span>
                                </div>
                                
                                <div className="data-row mb-4">
                                    <div>
                                        <span className="text-xl font-bold text-lime-400 cyber-glow">
                                            {activeSwapPoolFromRedux[1].primary_token_symbol}
                                        </span>
                                        <span className="cyber-status text-gray-500 ml-2">
                                            [PRIMARY]
                                        </span>
                                    </div>
                                    {primaryLogo && (
                                        <img src={primaryLogo} alt="Primary token" className="w-8 h-8 opacity-80 hover:opacity-100 transition-opacity" />
                                    )}
                                </div>
                                
                                <div className="data-row">
                                    <div>
                                        <span className="text-xl font-medium text-gray-300">
                                            {activeSwapPoolFromRedux[1].secondary_token_symbol}
                                        </span>
                                        <span className="cyber-status text-gray-600 ml-2">
                                            [SECONDARY]
                                        </span>
                                    </div>
                                    {secondaryLogo && (
                                        <img src={secondaryLogo} alt="Secondary token" className="w-8 h-8 opacity-60 hover:opacity-80 transition-opacity" />
                                    )}
                                </div>
                            </div>
                            
                            <div className="terminal-divider pt-4">
                                <h4 className="section-header">
                                    <span className="terminal-prompt">&gt;&gt;</span> POOL_METRICS
                                </h4>
                                <div className="space-y-3">
                                    <div className="data-row">
                                        <span className="data-label">max_supply:</span>
                                        <span className="data-primary">
                                            {Number(TokenConversionService.formatE8sDisplay(activeSwapPoolFromRedux[1].primary_token_max_supply, 0)).toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    {tokenomics.totalPrimarySupply && (
                                        <div className="data-row">
                                            <span className="data-label">current_supply:</span>
                                            <div className="text-right">
                                                <span className="data-value">
                                                    {Number(TokenConversionService.formatE8sDisplay(tokenomics.totalPrimarySupply, 0)).toLocaleString()}
                                                </span>
                                                <span className="data-accent ml-2">
                                                    [{((BigInt(tokenomics.totalPrimarySupply) * BigInt(100)) / BigInt(activeSwapPoolFromRedux[1].primary_token_max_supply)).toString()}%]
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {!activeSwapPoolFromRedux[1].isLive && countdown && (
                                        <div className="data-row pt-2 border-t border-pink-900/20">
                                            <span className="data-label">launch_in:</span>
                                            <span className="cyber-status text-pink-400">
                                                {countdown}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {activeSwapPoolFromRedux[1].isLive && (
                                        <div className="data-row pt-2 border-t border-pink-900/20">
                                            <span className="data-label">status:</span>
                                            <span className="cyber-status text-green-400">
                                                [LIVE]
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};
export default PoolCard;