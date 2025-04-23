import React, { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getUpcomming from "../thunk/getUpcommingTokens.thunk";
import getLiveTokens from "../thunk/getLiveTokens.thunk copy";

const GetLiveTokens = () => {
  const dispatch = useAppDispatch();

  const { liveTokens, loading, error,success } = useAppSelector((state) => state.lbryFun);

  useEffect(() => {
    dispatch(getLiveTokens());
  }, [success]);

  if (loading) return <p>Loading token pools...</p>;

//   if (error) return (
//     <div className="text-red-500">
//       <p><strong>{error.title}</strong>: {error.message}</p>
//     </div>
//   );

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Token Pools</h3>
      {liveTokens.length === 0 ? (
        <p>No token pools found.</p>
      ) : (
        <ul className="space-y-2">
          {liveTokens.map(([id, record]) => (
            <li key={id.toString()} className="border p-4 rounded shadow-sm">
              <p><strong>ID:</strong> {id.toString()}</p>
              <p><strong>Primary Canister id:</strong> {(record.primary_token_id).toString()}</p>
              <p><strong>Primary Name:</strong> {record.primary_token_name}</p>
              <p><strong>Primary Symbol:</strong> {record.primary_token_symbol}</p>
              <p><strong>Secondary Canister id:</strong> {(record.secondary_token_id).toString()}</p>
              <p><strong>Secondary Name:</strong> {record.secondary_token_name}</p>
              <p><strong>Secondary Symbol:</strong> {record.secondary_token_symbol}</p>
              {/* Add other TokenRecord fields as needed */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GetLiveTokens;
