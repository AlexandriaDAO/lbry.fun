import React, { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getTokenPools from "./thunk/getTokenPools.thunk";

const GetTokenPools = () => {
  const dispatch = useAppDispatch();

  const { tokenPools, loading, error,success } = useAppSelector((state) => state.lbryFun);

  useEffect(() => {
    dispatch(getTokenPools());
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
      {tokenPools.length === 0 ? (
        <p>No token pools found.</p>
      ) : (
        <ul className="space-y-2">
          {tokenPools.map(([id, record]) => (
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

export default GetTokenPools;
