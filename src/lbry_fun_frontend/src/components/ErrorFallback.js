import React from "react";
import { Dialog, DialogContent } from "@/lib/components/dialog";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { Button } from "@/lib/components/button";
const ErrorFallback = ({ error }) => {
    return (React.createElement(Dialog, { open: true, modal: true },
        React.createElement(DialogContent, { closeIcon: null, onOpenAutoFocus: (e) => e.preventDefault(), className: "font-roboto-condensed outline-none mx-auto max-w-md bg-white p-8 text-[#828282]" },
            React.createElement(DialogTitle, { className: "sr-only" }, "Error"),
            React.createElement(DialogDescription, { className: "text-center" }, "Something went wrong."),
            React.createElement("p", { style: { color: "red" } }, error.message),
            React.createElement(Button, { variant: "link", onClick: () => window.location.reload() }, "Refresh Page"))));
};
export default ErrorFallback;
