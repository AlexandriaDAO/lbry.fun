import { useLogout } from "@/hooks/useLogout";
import { LogOut, Settings, User } from "lucide-react";
import React from "react";
import { NavLink } from "react-router";
const AuthNavigation = () => {
    const logout = useLogout();
    return (React.createElement("div", { className: "flex flex-col items-start gap-2" },
        React.createElement(NavLink, { to: "profile", className: ({ isActive }) => `
                    px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                    ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                ` },
            React.createElement(User, { size: 18 }),
            React.createElement("span", null, "Profile")),
        React.createElement(NavLink, { to: "settings", className: ({ isActive }) => `
                    px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                    ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                ` },
            React.createElement(Settings, { size: 18 }),
            React.createElement("span", null, "Settings")),
        React.createElement("div", { onClick: logout, className: "cursor-pointer px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all text-primary/75 bg-muted border border-border/75 hover:text-primary hover:border-border" },
            React.createElement(LogOut, { size: 18 }),
            React.createElement("span", null, "End Session"))));
};
export default AuthNavigation;
