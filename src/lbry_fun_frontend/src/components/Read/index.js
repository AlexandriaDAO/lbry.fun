import React from 'react';
export const Read = ({ title, actions, children, above = null }) => {
    return (React.createElement("div", { className: "grid grid-cols-1 gap-4" },
        React.createElement("div", { className: "flex items-center gap-2 flex-wrap justify-between" },
            React.createElement("h1", { className: "h1" }, title),
            actions && (React.createElement("div", { className: "flex items-start flex-wrap gap-2" }, actions))),
        above,
        React.createElement("div", { className: "w-full border border-stone-300 rounded overflow-hidden" }, children)));
};
