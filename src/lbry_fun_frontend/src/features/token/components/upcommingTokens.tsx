import React, { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getUpcomming from "../thunk/getUpcommingTokens.thunk";

const UpcommingToken = () => {
  const dispatch = useAppDispatch();
  const { upcommingTokens, loading, error, success } = useAppSelector((state) => state.lbryFun);

  useEffect(() => {
    dispatch(getUpcomming());
  }, [success]);

  if (loading) return <p>Loading token pools...</p>;

  return (
    <div className="overflow-x-auto">
      <h3 className="text-xl font-semibold mb-4">Tokenm Pools</h3>
      {upcommingTokens.length === 0 ? (
        <p>No token pools found.</p>
      ) : (
        <table className="min-w-full table-auto border-collapse border border-gray-200 shadow-md rounded-md">
          <thead className="bg-gray-100 text-sm text-gray-700 uppercase">
            <tr>
              <th className="border p-2">ID</th>
              <th className="border p-2">Primary ID</th>
              <th className="border p-2">Primary Name</th>
              <th className="border p-2">Primary Symbol</th>
              <th className="border p-2">Secondary ID</th>
              <th className="border p-2">Secondary Name</th>
              <th className="border p-2">Secondary Symbol</th>
            </tr>
          </thead>
          <tbody>
            {upcommingTokens.map(([id, record]) => (
              <tr key={id.toString()} className="odd:bg-white even:bg-gray-50">
                <td className="border p-2">{id.toString()}</td>
                <td className="border p-2">{record.primary_token_id.toString()}</td>
                <td className="border p-2">{record.primary_token_name}</td>
                <td className="border p-2">{record.primary_token_symbol}</td>
                <td className="border p-2">{record.secondary_token_id.toString()}</td>
                <td className="border p-2">{record.secondary_token_name}</td>
                <td className="border p-2">{record.secondary_token_symbol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UpcommingToken;
