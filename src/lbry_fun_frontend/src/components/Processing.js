import React from "react";
import { LoaderCircle } from "lucide-react";
const Processing = ({ message = "Processing..." }) => (React.createElement("div", { className: "flex-shrink h-auto flex justify-between gap-1 px-4 py-2 items-center border border-white text-[#828282] rounded-full cursor-not-allowed" },
    React.createElement("span", { className: "w-max text-base font-normal font-roboto-condensed tracking-wider" }, message),
    React.createElement(LoaderCircle, { size: 18, className: "animate animate-spin" })));
export default Processing;
