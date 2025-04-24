import React, { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getTokenPools from "../thunk/getTokenPools.thunk";

const GetTokenPools = () => {
  const dispatch = useAppDispatch();
  const { tokenPools, loading, error, success } = useAppSelector((state) => state.lbryFun);

  useEffect(() => {
    dispatch(getTokenPools());
  }, [success]);

  if (loading) return <p className="text-gray-500">Loading token pools...</p>;

  return (
    <div className="container px-2">
      <h2 className="text-2xl font-bold mb-4 text-foreground">Token Pools</h2>
      <div className="overflow-x-auto">
        {tokenPools.length === 0 ? (
          <p className="text-gray-500">No token pools found.</p>
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
                  <th className="p-4 text-base text-[#64748B] dark:text-white font-medium rounded-r-xl">
                    Secondary Canister ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokenPools.map(([id, record]) => (
                  <tr
                    key={id.toString()}
                    className="bg-white dark:bg-[#2D2A26] hover:bg-[#0F172A] hover:text-white dark:hover:bg-gray-600 shadow-sm"
                  >
                    <td className="p-4 text-center dark:text-white rounded-l-xl bg-inherit">
                      {id.toString()}
                    </td>
                    <td className="p-4 text-center hover:text-white bg-inherit">
                      {record.primary_token_id.toString()}
                    </td>
                    <td className="p-4 text-center  dark:text-white bg-inherit">
                      {record.primary_token_name}
                    </td>
                    <td className="p-4 text-center  dark:text-white bg-inherit">
                      {record.primary_token_symbol}
                    </td>
                    <td className="p-4 text-center  dark:text-white bg-inherit">
                      {record.secondary_token_id.toString()}
                    </td>
                    <td className="p-4 text-center  dark:text-white bg-inherit">
                      {record.secondary_token_name}
                    </td>
                    <td className="p-4 text-center  dark:text-white rounded-r-xl bg-inherit">
                      {record.secondary_token_symbol}
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
