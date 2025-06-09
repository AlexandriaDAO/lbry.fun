import React, { useEffect } from "react";
import NProgress from "nprogress";
import HeaderSkeleton from "./HeaderSkeleton";
import SidebarSkeleton from "./SidebarSkeleton";
import MainPageSkeleton from "./MainPageSkeleton";
const LayoutSkeleton = () => {
    useEffect(() => {
        NProgress.start();
        return () => {
            NProgress.done();
        };
    }, []);
    return (React.createElement(React.Fragment, null,
        React.createElement(HeaderSkeleton, null),
        React.createElement("div", { className: "flex-grow flex items-stretch" },
            React.createElement(SidebarSkeleton, null),
            React.createElement(MainPageSkeleton, null))));
};
export default LayoutSkeleton;
