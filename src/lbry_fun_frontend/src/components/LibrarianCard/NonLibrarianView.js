import React from "react";
import { useNavigate } from "react-router";
import { Button } from "@/lib/components/button";
import { LockKeyhole } from "lucide-react";
function NonLibrarianView() {
    const navigate = useNavigate();
    return (React.createElement("div", { className: "flex flex-col items-center justify-between gap-3" },
        React.createElement("div", { className: "p-2 bg-muted border rounded-full" },
            React.createElement(LockKeyhole, { size: 22, className: "text-primary" })),
        React.createElement("span", { className: "font-roboto-condensed font-medium text-base" }, "Become Librarian to create your personal nodes and access librarian profile data"),
        React.createElement(Button, { variant: "link", scale: "sm", onClick: () => navigate('/dashboard/profile/upgrade') },
            React.createElement("span", null, "Become Librarian"))));
}
NonLibrarianView.displayName = 'NonLibrarianView';
export default NonLibrarianView;
