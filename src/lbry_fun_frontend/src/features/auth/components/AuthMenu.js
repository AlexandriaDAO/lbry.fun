import React from "react";
import { LogIn, LogOut, UserCircle, } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/lib/components/dropdown-menu";
import { useLogout } from "@/hooks/useLogout";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useIdentity } from "@/hooks/useIdentity";
import { Button } from "@/lib/components/button";
import { Skeleton } from "@/lib/components/skeleton";
import { principalToString } from "@/utils/principal";
export default function AuthMenu() {
    const logout = useLogout();
    const { login, isLoggingIn, identity } = useIdentity();
    const { isAuthenticated, principal, isLoading: authReduxLoading, isInitialized: authReduxInitialized } = useAppSelector(state => state.auth);
    const handleLogin = () => {
        if (login) {
            login();
        }
    };
    const isMenuLoading = !authReduxInitialized || authReduxLoading || isLoggingIn;
    if (isMenuLoading) {
        return React.createElement(Skeleton, { className: "h-[42px] w-[42px] rounded-full" });
    }
    if (!isAuthenticated) {
        return (React.createElement(Button, { onClick: handleLogin, variant: "outline", className: "rounded-full p-2 h-[42px] w-[42px]", disabled: !login },
            React.createElement(LogIn, { size: 18 })));
    }
    const displayPrincipal = principal ? principalToString(principal) : "Principal ID";
    return (React.createElement(DropdownMenu, null,
        React.createElement(DropdownMenuTrigger, { asChild: true },
            React.createElement("div", { className: "w-[42px] h-[42px] border border-white dark:border-gray-700 rounded-full cursor-pointer bg-gray-200 dark:bg-gray-800 flex items-center justify-center" },
                React.createElement(UserCircle, { size: 24, className: "text-gray-700 dark:text-gray-300" }))),
        React.createElement(DropdownMenuContent, { className: "w-56", side: "bottom", align: "end" },
            principal && (React.createElement(DropdownMenuLabel, { className: "text-center truncate" }, displayPrincipal)),
            React.createElement(DropdownMenuSeparator, null),
            React.createElement(DropdownMenuItem, { className: "cursor-pointer", onClick: logout },
                React.createElement(LogOut, { className: "mr-2 h-4 w-4" }),
                React.createElement("span", null, "Log out")))));
}
