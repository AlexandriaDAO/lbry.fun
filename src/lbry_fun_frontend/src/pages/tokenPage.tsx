import React, { useEffect } from "react";
import CreateTokenForm from "@/features/token/createTokenForm";
import GetTokenPools from "@/features/token/getTokenPools";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";

const TokenPage = () => {
    const dispatch = useAppDispatch();
    const icp = useAppSelector((state) => state.icpLedger);
    const { user } = useAppSelector((state) => state.auth);

    useEffect(() => {
        if (!user) return;
        dispatch(getIcpBal(user?.principal));
    }, [user]);

    return (
        <div className="p-6 flex flex-col items-center space-y-6 bg-gray-50 min-h-screen">
            <div className="w-full max-w-xl space-y-4">
                {/* ICP Balance Card */}
                <div className="bg-white shadow-md rounded-md p-4 border border-gray-200">
                    <h2 className="text-xl font-semibold mb-2">ICP Balance</h2>
                    <p className="text-2xl text-blue-600 font-bold">
                        {icp.accountBalance ?? "Loading..."}
                    </p>
                </div>

                {/* ICP Requirement Notice */}
                <div className="bg-white shadow-sm rounded-md border border-gray-200 p-4">
                    <div className="flex items-center space-x-2">
                        <span className="text-yellow-500 text-lg">⚠️</span>
                        <div>
                            <p className="font-medium text-gray-800">Notice:</p>
                            <p className="text-gray-600 text-sm">2 ICP is required to create new tokens.</p>
                        </div>
                    </div>
                </div>

                {/* Token Creation Form */}
                <CreateTokenForm />

                {/* Token Pools */}
                <GetTokenPools />
            </div>
        </div>
    );
};

export default TokenPage;


