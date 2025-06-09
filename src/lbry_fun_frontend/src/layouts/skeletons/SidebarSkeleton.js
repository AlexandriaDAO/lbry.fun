import React from "react";
const SidebarSkeleton = () => {
    return (React.createElement("div", { className: "basis-1/5 flex-shrink-0" },
        React.createElement("div", { className: "h-full flex flex-col justify-between p-4" },
            React.createElement("div", { className: "flex flex-col gap-8" },
                React.createElement("div", { className: "flex flex-col gap-3" }, [1, 2, 3, 4, 5].map((i) => (React.createElement("div", { key: i, className: "px-4 py-2 rounded-full flex items-center gap-2 animate-pulse" },
                    React.createElement("div", { className: "w-5 h-5 rounded-full bg-gray-200" }),
                    " ",
                    React.createElement("div", { className: "w-24 h-4 bg-gray-200 rounded" }),
                    " "))))),
            React.createElement("div", { className: "w-full h-12 bg-gray-200 rounded animate-pulse" }),
            " ")));
};
export default SidebarSkeleton;
