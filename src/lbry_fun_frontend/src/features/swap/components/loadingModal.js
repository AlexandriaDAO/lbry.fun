import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
const LoadingModal = ({ show, message1, message2, setShow }) => {
    if (!show)
        return null; // Only render modal if show is true
    return (React.createElement("div", { className: "bg-black/80 flex items-center justify-center min-h-screen w-full fixed z-50 top-0 left-0" },
        React.createElement("div", { className: "bg-background border border-border max-w-sm w-full h-[430px] rounded-2xl p-7 pb-14 w-11/12" },
            React.createElement("div", { className: "text-right mb-9" },
                React.createElement(FontAwesomeIcon, { icon: faXmark, className: "text-muted-foreground text-2xl", onClick: () => { setShow(false); }, role: "button" })),
            React.createElement("div", { className: "relative flex items-center justify-center w-40 h-40 mx-auto rounder-full mb-5" },
                React.createElement("svg", { viewBox: "0 0 160 160", className: "animate-spin" },
                    React.createElement("g", { id: "Group_6891", "data-name": "Group 6891", transform: "translate(-3382 704)" },
                        React.createElement("g", { id: "Ellipse_110", "data-name": "Ellipse 110", transform: "translate(3382 -704)", fill: "none", stroke: "currentColor", strokeOpacity: "0.2", strokeWidth: "5" },
                            React.createElement("circle", { cx: "80", cy: "80", r: "80", stroke: "none" }),
                            React.createElement("circle", { cx: "80", cy: "80", r: "77.5", fill: "none" })),
                        React.createElement("g", { id: "Ellipse_111", "data-name": "Ellipse 111", transform: "translate(3382 -704)", fill: "none", stroke: "currentColor", strokeWidth: "5", strokeDasharray: "161 362" },
                            React.createElement("circle", { cx: "80", cy: "80", r: "80", stroke: "none" }),
                            React.createElement("circle", { cx: "80", cy: "80", r: "77.5", fill: "none" }))))),
            React.createElement("div", { className: "text-center" },
                React.createElement("h4", { className: "text-foreground text-2xl font-medium mb-4" }, message1),
                React.createElement("p", { className: "text-muted-foreground m-0 text-base font-normal leading-6" }, message2)))));
};
export default LoadingModal;
