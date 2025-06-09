import React from "react";
import Auth from "@/features/auth";
import Logo from "@/components/Logo";
function AppHeader() {
    return (React.createElement("div", { className: `flex-grow-0 flex-shrink-0 bg-transparent flex flex-col justify-center items-stretch px-10` },
        React.createElement("div", { className: "flex-grow-0 flex-shrink-0 flex basis-24 justify-between items-center" },
            React.createElement(Logo, null),
            React.createElement(Auth, null))));
}
export default AppHeader;
