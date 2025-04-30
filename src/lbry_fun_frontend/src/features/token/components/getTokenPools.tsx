import React, { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getTokenPools from "../thunk/getTokenPools.thunk";
import { Button } from "antd/es";
import { useNavigate } from "react-router-dom";

const GetTokenPools = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tokenPools, loading, error, success } = useAppSelector((state) => state.lbryFun);

  useEffect(() => {
    dispatch(getTokenPools());
  }, [success]);

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
              <thead className="bg-[#F8FAFC] dark:bg-[#2D2A26]">
                <tr>
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium rounded-l-xl">
                    ID
                  </th>
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium">
                    Primary Ticker
                  </th>
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium">
                    Primary Name
                  </th>
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium">
                    Primary Canister ID
                  </th>
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium">
                    Secondary Ticker
                  </th>
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium">
                    Secondary Name
                  </th>
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium">
                    Secondary Canister ID
                  </th>
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium">
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
                    <td className="p-4 text-center hover:text-white bg-inherit">
                      {record.primary_token_symbol}
                    </td>
                    <td className="p-4 text-center dark:text-white bg-inherit">
                      {record.primary_token_name}
                    </td>
                    <td className="p-4 text-center dark:text-white bg-inherit">
                      {record.primary_token_id}
                    </td>
                    <td className="p-4 text-center dark:text-white bg-inherit">
                      {record.secondary_token_symbol}
                    </td>
                    <td className="p-4 text-center dark:text-white bg-inherit">
                      {record.secondary_token_name}
                    </td>
                    <td className="p-4 text-center dark:text-white bg-inherit">
                      {record.secondary_token_id}
                    </td>
                    <td className="p-4 text-center dark:text-white bg-inherit">
                      {record.icp_swap_canister_id}
                    </td>
                    <td className="p-4 text-center dark:text-white  bg-inherit">
                      <span className={`px-2 py-1 rounded text-xs ${record.isLive ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-[#000]'}`}>
                        {record.isLive ? 'Live' : 'Upcoming'}
                      </span>
                    </td>
                    <td className="p-4 text-center dark:text-white bg-inherit flex items-center ">
                      <Button className="mr-2 inline-flex gap-2 items-center justify-center whitespace-nowrap font-medium font-roboto-condensed ring-offset-background transition-all duration-100 ease-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-[#5555FF] lg:px-7 md:px-5 sm:px-4 xs:px-2 text-white lg:text-lg md:text-base text-sm border-2 border-[#5555FF] rounded-xl hover:bg-white hover:text-[#353535] dark:bg-[#FFFFFF] dark:border-[#FFFFFF] dark:text-[#0F1F2A] hover:dark:border-[#FFFFFF] hover:dark:text-[#FFFFFF] hover:dark:bg-transparent"
                        onClick={()=>{navigate("/swap?id="+id)}}>Swap</Button>
                      <Button className="inline-flex gap-2 items-center justify-center whitespace-nowrap font-medium font-roboto-condensed ring-offset-background transition-all duration-100 ease-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-[#F1F5F9] lg:px-7 md:px-5 sm:px-4 xs:px-2 text-[#0F172A] lg:text-lg md:text-base text-sm border-2 border-[#F1F5F9] rounded-xl sm:me-5 xs:mb-2 hover:bg-white hover:text-[#353535] dark:bg-gray-600 dark:border-gray-600 dark:text-white hover:dark:border-gray-600 hover:dark:bg-transparent hover:dark:text-white"
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
