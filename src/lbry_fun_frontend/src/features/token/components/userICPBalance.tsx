import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import React, { useEffect } from "react";
import { RootState } from "@/store";

const UserICPBalance = () => {
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);
    const dispatch = useAppDispatch();
    const icp = useAppSelector((state: RootState) => state.icpLedger);
    
    useEffect(() => {
      if (isAuthenticated && principal) {
        dispatch(getIcpBal(principal));
      }
    }, [isAuthenticated, principal, dispatch]);
    return (<>
        <div className="pb-5">
            <div className="py-4 border-b-2 border-b-[#FF9900] mb-4 px-2">
                <h2 className="text-2xl font-bold mb-2 text-foreground">Balance</h2>
                <p className="text-lg text-black font-semibold text-foreground">
                    {/* {icp.accountBalance ?? "Loading..."} */}
                    <span className="text-[#5EBF82]">{icp.accountBalance}</span>  ICP
                </p>
            </div>

            <div className="border-b-2 border-b-[#64748B] bg-[#EEFFEC] dark:bg-[#42403A]">

                <div className="mb-2 py-4 px-2">
                    <p className="font-semibold text-black text-foreground text-lg mb-4">Notice:</p>
                    <p className="text-base text-[#334155] text-foreground font-normal"><strong>2 ICP </strong> is required to create new tokens.</p>
                </div>
            </div>
        </div>
    </>);
}
export default UserICPBalance;
