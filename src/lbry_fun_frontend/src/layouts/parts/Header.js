import React, { useState } from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import Logo from "@/components/Logo";
import Tabs from "@/components/Tabs";
import { useIdentity } from "@/hooks/useIdentity";
import { ModeToggle } from "@/lib/components/mode-toggle";
import AuthMenu from "@/features/auth/components/AuthMenu";
export const Entry = () => {
    const { isInitializing, isLoggingIn } = useIdentity();
    const { isAuthenticated, isLoading: authLoading, error: authError } = useAppSelector((state) => state.auth);
    const { loading: loginUiLoading, error: loginUiError } = useAppSelector((state) => state.login);
    const isLoading = isInitializing || isLoggingIn || authLoading || loginUiLoading;
    return (React.createElement("div", { className: "flex items-center gap-2" },
        React.createElement(ModeToggle, null),
        React.createElement(AuthMenu, null)));
};
const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };
    return (React.createElement("header", { className: "sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" },
        React.createElement("div", { className: "container flex h-14 max-w-screen-2xl items-center" },
            React.createElement(Logo, null),
            React.createElement("div", { className: "hidden md:flex flex-1 items-center justify-between ml-4" },
                React.createElement(Tabs, null),
                React.createElement("nav", { className: "flex items-center" },
                    React.createElement(Entry, null))),
            React.createElement("div", { className: "md:hidden flex flex-1 justify-end items-center" },
                React.createElement("button", { onClick: toggleMenu, className: "p-2" }, isMenuOpen ? (React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: "w-6 h-6" },
                    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }))) : (React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", strokeWidth: 1.5, stroke: "currentColor", className: "w-6 h-6" },
                    React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" })))))),
        isMenuOpen && (React.createElement("div", { className: "md:hidden" },
            React.createElement("nav", { className: "flex flex-col items-center px-2 py-4 border-t border-border/40" },
                React.createElement(Tabs, null),
                React.createElement("div", { className: "mt-4" },
                    React.createElement(Entry, null)))))));
};
export default Header;
