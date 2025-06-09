import React from "react";
import { Dialog, DialogContent } from "@/lib/components/dialog";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
const Loading = () => (React.createElement(Dialog, { open: true, modal: true },
    React.createElement(DialogContent, { closeIcon: null, onOpenAutoFocus: (e) => e.preventDefault(), className: "font-roboto-condensed outline-none mx-auto max-w-md p-8 border-gray-500" },
        React.createElement(DialogTitle, { className: "sr-only" }, "Loading"),
        React.createElement(DialogDescription, { className: "text-center" }, "Please wait while we load page."),
        React.createElement("div", { className: "flex flex-col items-center gap-4" },
            React.createElement("div", { className: "animate-spin rounded-full h-10 w-10 border-b-2 border-[#828282]" }),
            React.createElement("p", { className: "text-lg font-medium" }, "Loading...")))));
export default Loading;
