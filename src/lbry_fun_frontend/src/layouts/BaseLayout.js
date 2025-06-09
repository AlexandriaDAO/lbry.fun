import React from "react";
import { Toaster } from "@/lib/components/sonner";
import { Outlet } from "react-router";
import { useRiskWarning } from "@/hooks/useRiskWarning";
import RiskWarningModal from "@/components/RiskWarningModal";
// Define the type for the component's props
const BaseLayout = () => {
    const { showRiskWarning, handleCloseRiskWarning } = useRiskWarning();
    return (React.createElement("div", { className: "min-h-screen min-w-screen flex flex-col bg-background" },
        showRiskWarning && React.createElement(RiskWarningModal, { onClose: handleCloseRiskWarning, open: showRiskWarning }),
        React.createElement(Outlet, null),
        React.createElement(Toaster, null)));
};
export default BaseLayout;
