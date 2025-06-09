import React from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import LibrarianView from "./LibrarianView";
import NonLibrarianView from "./NonLibrarianView";
function LibrarianCard() {
    const { principal } = useAppSelector(state => state.auth);
    if (!principal) {
        return null;
    }
    return (React.createElement("div", { className: "max-w-md p-3 flex gap-2 flex-col rounded-xl border" },
        React.createElement("div", { className: "flex justify-between items-center" },
            React.createElement("div", { className: "font-syne font-medium text-xl" }, "Librarian")),
        React.createElement("div", { className: "flex flex-col gap-4 justify-start items-center" }, principal === "2vxsx-fae" ? React.createElement(LibrarianView, null) : React.createElement(NonLibrarianView, null))));
}
export default LibrarianCard;
