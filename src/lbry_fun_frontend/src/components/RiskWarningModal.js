import React from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, } from "@/lib/components/alert-dialog";
import { ScrollArea } from "@/lib/components/scroll-area";
const RiskWarningModal = ({ onClose, open }) => {
    return (React.createElement(AlertDialog, { open: open },
        React.createElement(AlertDialogContent, { className: "max-w-3xl" },
            React.createElement(AlertDialogHeader, { className: 'space-y-0' },
                React.createElement(AlertDialogTitle, null, "Important Notice"),
                React.createElement(AlertDialogDescription, null, "Project Status: Pre-Alpha")),
            React.createElement(ScrollArea, { className: "pr-4" },
                React.createElement("div", { className: "p-4 space-y-4" },
                    React.createElement("p", { className: "font-medium" }, "This project is in pre-alpha stage. Use at your own risk."),
                    React.createElement("p", null, "For more information, please contact the project administrators."))),
            React.createElement(AlertDialogFooter, null,
                React.createElement(AlertDialogAction, { onClick: onClose }, "I Understand")))));
};
export default RiskWarningModal;
