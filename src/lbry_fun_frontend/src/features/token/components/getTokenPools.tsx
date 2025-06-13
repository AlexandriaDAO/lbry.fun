import React, { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getTokenPools from "../thunk/getTokenPools.thunk";
import { Button } from "@/lib/components/button";
import { useNavigate } from "react-router-dom";
import { lbryFunFlagHandler } from '@/features/token/lbryFunSlice'; // If you need to reset flags

const GetTokenPools = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tokenPools, loading, error, success } = useAppSelector((state) => state.lbryFun);

  useEffect(() => {
    // Fetch if pools are not loaded, not currently loading, and there was no previous persistent error
    // This condition prevents re-fetching if already loaded or if an error state needs manual reset.
    if (tokenPools.length === 0 && !loading && !error) {
      dispatch(getTokenPools());
    }
    // Or, if you want to re-fetch if 'success' was reset by lbryFunFlagHandler:
    // if (!success && !loading && !error) {
    //    dispatch(getTokenPools());
    // }
  }, [dispatch, tokenPools.length, loading, error, success]);

  if (loading) return <p className="text-gray-500">Loading token pools...</p>;

  return (
    <div className="overflow-x-auto w-full ">
      <h2 className="text-2xl font-bold mb-4 text-foreground">All Tokens</h2>
      <div className="overflow-x-auto">
        {tokenPools?.length === 0 ? (
          <p className="text-gray-500">No tokens found.</p>
        ) : (
          <div className="overflow-hidden ">
            <table className="min-w-full table-auto text-sm border-separate border-spacing-y-2">
              <thead className="bg-muted">
                <tr>
                  <th className="p-4 text-base text-muted-foreground font-medium rounded-l-xl">
                    ID
                  </th>
                  <th className="p-4 text-base text-muted-foreground font-medium">
                    Primary Ticker
                  </th>
                  <th className="p-4 text-base text-muted-foreground font-medium">
                    Primary Name
                  </th>
                  <th className="p-4 text-base text-muted-foreground font-medium">
                    Primary Canister ID
                  </th>
                  <th className="p-4 text-base text-muted-foreground font-medium">
                    Secondary Ticker
                  </th>
                  <th className="p-4 text-base text-muted-foreground font-medium">
                    Secondary Name
                  </th>
                  <th className="p-4 text-base text-muted-foreground font-medium">
                    Secondary Canister ID
                  </th>
                  <th className="p-4 text-base text-muted-foreground font-medium">
                    Swap Canister ID
                  </th>
                  <th className="p-4 text-base text-[#64748B] dark:text-grey font-medium ">
                    Status
                  </th>
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium ">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokenPools?.map(([id, record]) => (
                  <tr
                    key={id}
                    className="bg-white dark:bg-[#2D2A26] hover:bg-[#5555FF] hover:text-white dark:hover:bg-gray-600 shadow-sm"
                  >
                    <td className="p-4 text-center dark:text-white rounded-l-xl bg-inherit">
                      {id}
                    </td>
                    <td className="p-4 text-center text-foreground bg-inherit">
                      {record.primary_token_symbol}
                    </td>
                    <td className="p-4 text-center text-foreground bg-inherit">
                      {record.primary_token_name}
                    </td>
                    <td className="p-4 text-center text-foreground bg-inherit">
                      {record.primary_token_id}
                    </td>
                    <td className="p-4 text-center text-foreground bg-inherit">
                      {record.secondary_token_symbol}
                    </td>
                    <td className="p-4 text-center text-foreground bg-inherit">
                      {record.secondary_token_name}
                    </td>
                    <td className="p-4 text-center text-foreground bg-inherit">
                      {record.secondary_token_id}
                    </td>
                    <td className="p-4 text-center text-foreground bg-inherit">
                      {record.icp_swap_canister_id}
                    </td>
                    <td className="p-4 text-center text-foreground bg-inherit">
                      <span className={`px-2 py-1 rounded text-xs ${record.isLive ? 'bg-constructive/20 text-constructive' : 'bg-primary/20 text-primary'}`}>
                        {record.isLive ? 'Live' : 'Upcoming'}
                      </span>
                    </td>
                    <td className="p-4 text-center dark:text-white bg-inherit flex items-center ">
                      <Button variant="default" size="sm" className="mr-2 lg:px-7 md:px-5 sm:px-4 xs:px-2 lg:text-lg md:text-base text-sm"
                        onClick={()=>{navigate("/swap?id="+id)}}>Swap</Button>
                      <Button variant="secondary" size="sm" className="lg:px-7 md:px-5 sm:px-4 xs:px-2 lg:text-lg md:text-base text-sm sm:me-5 xs:mb-2"
                        >Kong Swap</Button>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GetTokenPools;
