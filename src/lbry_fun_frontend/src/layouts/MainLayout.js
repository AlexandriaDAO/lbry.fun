import React from "react";
import Header from "./parts/Header";
import { Outlet } from "react-router";
// Define the type for the component's props
const MainLayout = () => {
    return (React.createElement(React.Fragment, null,
        React.createElement(Header, null),
        React.createElement(Outlet, null)));
};
export default MainLayout;
