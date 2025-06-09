import React from "react";
import { useNavigate } from "react-router";
import { Button } from "@/lib/components/button";
import { Check } from "lucide-react";
function LibrarianView() {
    const navigate = useNavigate();
    return (React.createElement("div", { className: "flex flex-col items-center justify-between gap-3" },
        React.createElement("div", { className: "p-2 bg-muted border rounded-full" },
            React.createElement(Check, { size: 22, className: "text-constructive" })),
        React.createElement("span", { className: "font-roboto-condensed font-medium text-base" }, "You are a Librarian, You can Add Nodes."),
        React.createElement(Button, { variant: "link", scale: "sm", onClick: () => navigate("/dashboard") }, "View Home")));
}
export default LibrarianView;
