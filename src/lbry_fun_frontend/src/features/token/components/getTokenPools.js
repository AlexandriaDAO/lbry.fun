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
    if (loading)
        return React.createElement("p", { className: "text-gray-500" }, "Loading token pools...");
    return (React.createElement("div", { className: "overflow-x-auto w-full " },
        React.createElement("h2", { className: "text-2xl font-bold mb-4 text-foreground" }, "All Tokens"),
        React.createElement("div", { className: "overflow-x-auto" }, tokenPools?.length === 0 ? (React.createElement("p", { className: "text-gray-500" }, "No tokens found.")) : (React.createElement("div", { className: "overflow-hidden " },
            React.createElement("table", { className: "min-w-full table-auto text-sm border-separate border-spacing-y-2" },
                React.createElement("thead", { className: "bg-[#F8FAFC] dark:bg-[#2D2A26]" },
                    React.createElement("tr", null,
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-white font-medium rounded-l-xl" }, "ID"),
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-white font-medium" }, "Primary Ticker"),
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-white font-medium" }, "Primary Name"),
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-white font-medium" }, "Primary Canister ID"),
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-white font-medium" }, "Secondary Ticker"),
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-white font-medium" }, "Secondary Name"),
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-white font-medium" }, "Secondary Canister ID"),
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-white font-medium" }, "Swap Canister ID"),
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-grey font-medium " }, "Status"),
                        React.createElement("th", { className: "p-4 text-base text-[#64748B] dark:text-white font-medium " }, "Actions"))),
                React.createElement("tbody", null, tokenPools?.map(([id, record]) => (React.createElement("tr", { key: id, className: "bg-white dark:bg-[#2D2A26] hover:bg-[#5555FF] hover:text-white dark:hover:bg-gray-600 shadow-sm" },
                    React.createElement("td", { className: "p-4 text-center dark:text-white rounded-l-xl bg-inherit" }, id),
                    React.createElement("td", { className: "p-4 text-center hover:text-white bg-inherit" }, record.primary_token_symbol),
                    React.createElement("td", { className: "p-4 text-center dark:text-white bg-inherit" }, record.primary_token_name),
                    React.createElement("td", { className: "p-4 text-center dark:text-white bg-inherit" }, record.primary_token_id),
                    React.createElement("td", { className: "p-4 text-center dark:text-white bg-inherit" }, record.secondary_token_symbol),
                    React.createElement("td", { className: "p-4 text-center dark:text-white bg-inherit" }, record.secondary_token_name),
                    React.createElement("td", { className: "p-4 text-center dark:text-white bg-inherit" }, record.secondary_token_id),
                    React.createElement("td", { className: "p-4 text-center dark:text-white bg-inherit" }, record.icp_swap_canister_id),
                    React.createElement("td", { className: "p-4 text-center dark:text-white  bg-inherit" },
                        React.createElement("span", { className: `px-2 py-1 rounded text-xs ${record.isLive ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-[#000]'}` }, record.isLive ? 'Live' : 'Upcoming')),
                    React.createElement("td", { className: "p-4 text-center dark:text-white bg-inherit flex items-center " },
                        React.createElement(Button, { className: "mr-2 inline-flex gap-2 items-center justify-center whitespace-nowrap font-medium font-roboto-condensed ring-offset-background transition-all duration-100 ease-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-[#5555FF] lg:px-7 md:px-5 sm:px-4 xs:px-2 text-white lg:text-lg md:text-base text-sm border-2 border-[#5555FF] rounded-xl hover:bg-white hover:text-[#353535] dark:bg-[#FFFFFF] dark:border-[#FFFFFF] dark:text-[#0F1F2A] hover:dark:border-[#FFFFFF] hover:dark:text-[#FFFFFF] hover:dark:bg-transparent", onClick: () => { navigate("/swap?id=" + id); } }, "Swap"),
                        React.createElement(Button, { className: "inline-flex gap-2 items-center justify-center whitespace-nowrap font-medium font-roboto-condensed ring-offset-background transition-all duration-100 ease-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-[#F1F5F9] lg:px-7 md:px-5 sm:px-4 xs:px-2 text-[#0F172A] lg:text-lg md:text-base text-sm border-2 border-[#F1F5F9] rounded-xl sm:me-5 xs:mb-2 hover:bg-white hover:text-[#353535] dark:bg-gray-600 dark:border-gray-600 dark:text-white hover:dark:border-gray-600 hover:dark:bg-transparent hover:dark:text-white" }, "Kong Swap"))))))))))));
};
export default GetTokenPools;
