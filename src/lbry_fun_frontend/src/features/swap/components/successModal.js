import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
const SuccessModal = ({ show, setShow }) => {
    if (!show)
        return null; // Only render modal if show is true
    return (React.createElement("div", { className: "bg-black/80 flex items-center justify-center min-h-screen w-full fixed z-50 top-0 left-0" },
        React.createElement("div", { className: "bg-background border border-border max-w-sm w-full h-[430px] rounded-2xl p-7 pb-14 w-11/12" },
            React.createElement("div", { className: "text-right mb-9" },
                React.createElement(FontAwesomeIcon, { icon: faXmark, className: "text-muted-foreground text-2xl", onClick: () => { setShow(false); }, role: "button" })),
            React.createElement("div", { className: "text-center" },
                React.createElement("div", { className: "mb-5" },
                    React.createElement("img", { src: "/images/tick.png" })),
                React.createElement("h4", { className: "text-foreground text-2xl font-medium" }, "Success!"),
                React.createElement("p", { className: "mb-4 text-muted-foreground text-base font-normal leading-6" }, "Transaction Submitted!"),
                React.createElement("button", { className: "h-14 min-w-72 rounded-[44px] px-7 bg-primary text-primary-foreground text-2xl font-semibold", onClick: () => { setShow(false); } }, "Close")))));
};
export default SuccessModal;
