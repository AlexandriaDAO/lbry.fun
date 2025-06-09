import React from "react";
import GetTokenPools from "@/features/token/components/getTokenPools";
const SuccessToken = () => {
    return (React.createElement("div", { className: "min-h-screen bg-background py-[100px] px-4" },
        React.createElement("div", { className: "container px-2" },
            React.createElement("div", { className: "text-center px-2 pb-10" },
                React.createElement("h1", { className: "text-5xl font-bold text-black text-foreground pb-8" },
                    "Your token has been created ",
                    React.createElement("span", { className: "text-[#16A34A]" }, "successfully"),
                    "!"))),
        React.createElement("div", { className: "container px-2" },
            React.createElement(GetTokenPools, null))));
};
export default SuccessToken;
