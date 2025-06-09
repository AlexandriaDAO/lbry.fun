import React, { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getLiveTokens from "../thunk/getLiveTokens.thunk";
const GetLiveTokens = () => {
    const dispatch = useAppDispatch();
    const { liveTokens, loading, error, success } = useAppSelector((state) => state.lbryFun);
    useEffect(() => {
        dispatch(getLiveTokens());
    }, [success]);
    if (loading)
        return React.createElement("p", null, "Loading token pools...");
    //   if (error) return (
    //     <div className="text-red-500">
    //       <p><strong>{error.title}</strong>: {error.message}</p>
    //     </div>
    //   );
    return (React.createElement("div", { className: "space-y-4" },
        React.createElement("h3", { className: "text-xl font-semibold" }, "Token Pools"),
        liveTokens.length === 0 ? (React.createElement("p", null, "No token pools found.")) : (React.createElement("ul", { className: "space-y-2" }, liveTokens.map(([id, record]) => (React.createElement("li", { key: id.toString(), className: "border p-4 rounded shadow-sm" },
            React.createElement("p", null,
                React.createElement("strong", null, "ID:"),
                " ",
                id.toString()),
            React.createElement("p", null,
                React.createElement("strong", null, "Primary Canister id:"),
                " ",
                (record.primary_token_id).toString()),
            React.createElement("p", null,
                React.createElement("strong", null, "Primary Name:"),
                " ",
                record.primary_token_name),
            React.createElement("p", null,
                React.createElement("strong", null, "Primary Symbol:"),
                " ",
                record.primary_token_symbol),
            React.createElement("p", null,
                React.createElement("strong", null, "Secondary Canister id:"),
                " ",
                (record.secondary_token_id).toString()),
            React.createElement("p", null,
                React.createElement("strong", null, "Secondary Name:"),
                " ",
                record.secondary_token_name),
            React.createElement("p", null,
                React.createElement("strong", null, "Secondary Symbol:"),
                " ",
                record.secondary_token_symbol))))))));
};
export default GetLiveTokens;
