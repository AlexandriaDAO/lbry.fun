import React from "react";
const HeaderSkeleton = () => {
    return (React.createElement("div", { className: "flex-grow-0 flex-shrink-0 bg-gray-900basis-24" },
        React.createElement("div", { className: "h-24 px-10 flex items-center justify-between" },
            React.createElement("div", { className: "w-32 h-8 bg-gray-600 rounded animate-pulse" }),
            React.createElement("div", { className: "flex gap-4" }, [1, 2, 3].map((i) => (React.createElement("div", { key: i, className: "w-24 h-8 bg-gray-600 rounded animate-pulse" })))),
            React.createElement("div", { className: "w-32 h-8 bg-gray-600 rounded animate-pulse" }),
            " ")));
};
export default HeaderSkeleton;
