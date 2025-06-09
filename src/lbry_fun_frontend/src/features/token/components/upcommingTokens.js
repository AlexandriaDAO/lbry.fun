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
    if (loading)
        return React.createElement("p", null, "Loading token pools...");
    return (React.createElement("div", { className: "overflow-x-auto" },
        React.createElement("h3", { className: "text-xl font-semibold mb-4" }, "Tokenm Pools"),
        upcommingTokens.length === 0 ? (React.createElement("p", null, "No token pools found.")) : (React.createElement("table", { className: "min-w-full table-auto border-collapse border border-gray-200 shadow-md rounded-md" },
            React.createElement("thead", { className: "bg-gray-100 text-sm text-gray-700 uppercase" },
                React.createElement("tr", null,
                    React.createElement("th", { className: "border p-2" }, "ID"),
                    React.createElement("th", { className: "border p-2" }, "Primary ID"),
                    React.createElement("th", { className: "border p-2" }, "Primary Name"),
                    React.createElement("th", { className: "border p-2" }, "Primary Symbol"),
                    React.createElement("th", { className: "border p-2" }, "Secondary ID"),
                    React.createElement("th", { className: "border p-2" }, "Secondary Name"),
                    React.createElement("th", { className: "border p-2" }, "Secondary Symbol"))),
            React.createElement("tbody", null, upcommingTokens.map(([id, record]) => (React.createElement("tr", { key: id.toString(), className: "odd:bg-white even:bg-gray-50" },
                React.createElement("td", { className: "border p-2" }, id.toString()),
                React.createElement("td", { className: "border p-2" }, record.primary_token_id.toString()),
                React.createElement("td", { className: "border p-2" }, record.primary_token_name),
                React.createElement("td", { className: "border p-2" }, record.primary_token_symbol),
                React.createElement("td", { className: "border p-2" }, record.secondary_token_id.toString()),
                React.createElement("td", { className: "border p-2" }, record.secondary_token_name),
                React.createElement("td", { className: "border p-2" }, record.secondary_token_symbol)))))))));
};
export default UpcommingToken;
