import React, { useEffect } from "react";
import NProgress from "nprogress";
const MainPageSkeleton = () => {
    useEffect(() => {
        NProgress.start();
        return () => {
            NProgress.done();
        };
    }, []);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "flex-grow px-4 py-8" },
            React.createElement("div", { className: "flex justify-between items-center mb-8" },
                React.createElement("div", { className: "w-32 h-8 bg-secondary rounded animate-pulse" }),
                React.createElement("div", { className: "w-32 h-8 bg-secondary rounded animate-pulse" })),
            React.createElement("div", { className: "bg-secondary rounded-lg shadow-md p-6" }))));
};
export default MainPageSkeleton;
