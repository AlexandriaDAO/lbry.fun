import React from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import CanisterCycles from "./CanisterCycles";

const InfoCard: React.FC = () => {
    const { activeSwapPool: activeSwapPoolFromRedux } = useAppSelector((state) => state.swap);

    const shortenCanisterId = (id: string) => {
        return `${id.slice(0, 6)}...${id.slice(-6)}`;
    };

    return (
        <div className="terminal-pure">
            <div className="terminal-header mb-2">
                <span className="terminal-prompt">&gt;&gt;</span> developer_info
            </div>

            {activeSwapPoolFromRedux ? (
                <>
                    <div className="terminal-section-minimal">
                        <div className="terminal-header mb-2">
                            <span className="terminal-prompt">&gt;</span> canister_registry
                        </div>
                        
                        <div className="terminal-info mb-2">
                            <div className="terminal-row">
                                <span className="terminal-label">icp_swap:</span>
                                <span className="hex-address" title={activeSwapPoolFromRedux[1].icp_swap_canister_id}>
                                    {shortenCanisterId(activeSwapPoolFromRedux[1].icp_swap_canister_id)}
                                </span>
                            </div>
                            <CanisterCycles canisterId={activeSwapPoolFromRedux[1].icp_swap_canister_id} />
                        </div>

                        <div className="terminal-info mb-2">
                            <div className="terminal-row">
                                <span className="terminal-label">tokenomics:</span>
                                <span className="hex-address" title={activeSwapPoolFromRedux[1].tokenomics_canister_id}>
                                    {shortenCanisterId(activeSwapPoolFromRedux[1].tokenomics_canister_id)}
                                </span>
                            </div>
                            <CanisterCycles canisterId={activeSwapPoolFromRedux[1].tokenomics_canister_id} />
                        </div>

                        <div className="terminal-info mb-2">
                            <div className="terminal-row">
                                <span className="terminal-label">logs:</span>
                                <span className="hex-address" title={activeSwapPoolFromRedux[1].logs_canister_id}>
                                    {shortenCanisterId(activeSwapPoolFromRedux[1].logs_canister_id)}
                                </span>
                            </div>
                            <CanisterCycles canisterId={activeSwapPoolFromRedux[1].logs_canister_id} />
                        </div>

                        <div className="terminal-info mb-2">
                            <div className="terminal-row">
                                <span className="terminal-label">primary_token:</span>
                                <span className="hex-address" title={activeSwapPoolFromRedux[1].primary_token_id}>
                                    {shortenCanisterId(activeSwapPoolFromRedux[1].primary_token_id)}
                                </span>
                            </div>
                            <CanisterCycles canisterId={activeSwapPoolFromRedux[1].primary_token_id} />
                        </div>

                        <div className="terminal-info">
                            <div className="terminal-row">
                                <span className="terminal-label">secondary_token:</span>
                                <span className="hex-address" title={activeSwapPoolFromRedux[1].secondary_token_id}>
                                    {shortenCanisterId(activeSwapPoolFromRedux[1].secondary_token_id)}
                                </span>
                            </div>
                            <CanisterCycles canisterId={activeSwapPoolFromRedux[1].secondary_token_id} />
                        </div>
                    </div>

                    <div className="terminal-section mt-4">
                        <div className="terminal-row">
                            <span className="terminal-label">status:</span>
                            <span className="terminal-primary">[ACTIVE]</span>
                        </div>
                        <div className="terminal-row">
                            <span className="terminal-label">network:</span>
                            <span className="terminal-value">internet_computer</span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="terminal-row">
                    <span className="terminal-label">status:</span>
                    <span className="terminal-accent">no_active_pool_selected</span>
                </div>
            )}
        </div>
    );
};

export default InfoCard;