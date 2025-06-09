import React from "react";
import AppHeader from "./parts/AppHeader";
const AppLayout = ({ children }) => {
    return (React.createElement("div", { className: "min-h-screen min-w-screen flex flex-col bg-[#f4f4f4]" },
        React.createElement(AppHeader, null),
        children));
};
export default AppLayout;
