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
    <div className="overflow-x-auto">
      {tokenPools.length === 0 ? (
        <p className="text-gray-500">No token pools found.</p>
      ) : (
        <table className="min-w-full table-auto border-b-2 border-b-[#64748B] text-sm">
          <thead className="">
            <tr>
              <th className="p-2 text-base text-[#64748B] dark:text-[white] font-medium ">ID</th>
              <th className="p-2 text-base text-[#64748B] dark:text-[white] font-medium">Primary Ticker</th>
              <th className="p-2 text-base text-[#64748B] dark:text-[white] font-medium">Primary Name</th>
              <th className="p-2 text-base text-[#64748B] dark:text-[white] font-medium">Primary Canister ID</th>
              <th className="p-2 text-base text-[#64748B] dark:text-[white] font-medium">Secondary Ticker</th>
              <th className="p-2 text-base text-[#64748B] dark:text-[white] font-medium">Secondary Name</th>
              <th className="p-2 text-base text-[#64748B] dark:text-[white] font-medium">Secondary Canister ID</th>
            </tr>
          </thead>
          <tbody>
            {tokenPools.map(([id, record]) => (
              <tr key={id.toString()} className="odd:bg-white even:bg-gray-50">
                <td className="border p-2 text-center text-[#64748B]  ">{id.toString()}</td>
                <td className="border p-2 text-center text-[#64748B] ">{record.primary_token_id.toString()}</td>
                <td className="border p-2 text-center text-[#64748B] ">{record.primary_token_name}</td>
                <td className="border p-2 text-center text-[#64748B] ">{record.primary_token_symbol}</td>
                <td className="border p-2 text-center text-[#64748B] ">{record.secondary_token_id.toString()}</td>
                <td className="border p-2 text-center text-[#64748B] ">{record.secondary_token_name}</td>
                <td className="border p-2 text-center text-[#64748B] ">{record.secondary_token_symbol}</td>
                
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default GetTokenPools;
