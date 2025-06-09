import React from "react";
import { useNavigate } from "react-router";
import { Button } from "@/lib/components/button";
import { ArrowLeft, Home } from "lucide-react";
const UnauthorizedPage = () => {
    const navigate = useNavigate();
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "min-h-[80vh] flex items-center justify-center px-4" },
            React.createElement("div", { className: "text-center" },
                React.createElement("h1", { className: "text-9xl font-bold text-gray-200" }, "401"),
                React.createElement("div", { className: "mt-4" },
                    React.createElement("h3", { className: "text-2xl font-semibold text-gray-800 md:text-3xl" }, "Unauthorized"),
                    React.createElement("p", { className: "mt-4 text-gray-600" }, "You are not authorized to access this page."),
                    React.createElement("div", { className: "mt-8 flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4 justify-center" },
                        React.createElement(Button, { variant: "info", className: "px-8 flex gap-2 justify-center items-center", onClick: () => navigate(-1) },
                            React.createElement(ArrowLeft, { size: 20 }),
                            React.createElement("span", null, "Go Back")),
                        React.createElement(Button, { variant: "link", className: "px-8 flex gap-2 justify-center items-center", onClick: () => navigate("/") },
                            React.createElement(Home, { size: 18 }),
                            React.createElement("span", null, "Go Home"))))))));
};
export default UnauthorizedPage;
