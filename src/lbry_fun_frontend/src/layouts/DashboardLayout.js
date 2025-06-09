import React from "react";
import { Outlet } from "react-router";
import Header from "./parts/Header";
import DashboardSidebar from "./parts/DashboardSidebar";
const DashboardLayout = () => {
    return (React.createElement(React.Fragment, null,
        React.createElement(Header, null),
        React.createElement("div", { className: "flex-grow flex items-stretch" },
            React.createElement("div", { className: "basis-1/5 flex-shrink-0" },
                React.createElement(DashboardSidebar, null)),
            React.createElement("div", { className: "flex-grow px-4 py-8" },
                React.createElement(Outlet, null)))));
};
export default DashboardLayout;
