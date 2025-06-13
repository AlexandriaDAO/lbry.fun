import React from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import CanisterCycles from "./CanisterCycles";

const InfoCard: React.FC = () => {
    const { activeSwapPool: activeSwapPoolFromRedux } = useAppSelector((state) => state.swap);

    return (
        <div
            style={{ backgroundImage: 'url("images/gradient-bg.png")' }}
            className="bg-interactive-primary text-primary-foreground py-10 xxl:px-14 xl:px-12 px-5 me-0 2xl:me-3 xl:me-3 lg:me-3 md:me-3 sm:me-0 rounded-3xl xxl:py-5 xxl:px-5 mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3"
        >
            <h4 className="account-box-bg text-2xl xl:text-xl font-medium mb-6">
                Developer Info
            </h4>

            {activeSwapPoolFromRedux ? (
                <div className="flex flex-col space-y-2">
                    <div className="p-2 rounded-lg bg-black bg-opacity-20">
                        <div className="flex justify-between">
                            <span className="font-semibold text-gray-300">ICP Swap Canister:</span>
                            <span className="text-white break-all">{activeSwapPoolFromRedux[1].icp_swap_canister_id}</span>
                        </div>
                        <CanisterCycles canisterId={activeSwapPoolFromRedux[1].icp_swap_canister_id} />
                    </div>
                    <div className="p-2 rounded-lg bg-black bg-opacity-20">
                        <div className="flex justify-between">
                            <span className="font-semibold text-gray-300">Tokenomics Canister:</span>
                            <span className="text-white break-all">{activeSwapPoolFromRedux[1].tokenomics_canister_id}</span>
                        </div>
                        <CanisterCycles canisterId={activeSwapPoolFromRedux[1].tokenomics_canister_id} />
                    </div>
                     <div className="p-2 rounded-lg bg-black bg-opacity-20">
                        <div className="flex justify-between">
                            <span className="font-semibold text-gray-300">Logs Canister:</span>
                            <span className="text-white break-all">{activeSwapPoolFromRedux[1].logs_canister_id}</span>
                        </div>
                        <CanisterCycles canisterId={activeSwapPoolFromRedux[1].logs_canister_id} />
                    </div>
                    <div className="p-2 rounded-lg bg-black bg-opacity-20">
                        <div className="flex justify-between">
                            <span className="font-semibold text-gray-300">Primary Token Canister:</span>
                            <span className="text-white break-all">{activeSwapPoolFromRedux[1].primary_token_id}</span>
                        </div>
                        <CanisterCycles canisterId={activeSwapPoolFromRedux[1].primary_token_id} />
                    </div>
                    <div className="p-2 rounded-lg bg-black bg-opacity-20">
                        <div className="flex justify-between">
                            <span className="font-semibold text-gray-300">Secondary Token Canister:</span>
                            <span className="text-white break-all">{activeSwapPoolFromRedux[1].secondary_token_id}</span>
                        </div>
                        <CanisterCycles canisterId={activeSwapPoolFromRedux[1].secondary_token_id} />
                    </div>
                </div>
            ) : (
                <p>No active swap pool selected.</p>
            )}
        </div>
    );
};

export default InfoCard; 