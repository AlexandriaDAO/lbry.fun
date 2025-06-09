import React from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { Navigate, Outlet } from "react-router";
const Protected = ({ children, route = false }) => {
    const { isAuthenticated, isLoading, isInitialized } = useAppSelector((state) => state.auth);
    if (isLoading || !isInitialized) {
        return null;
    }
    const allowed = isAuthenticated;
    if (route)
        return allowed ? React.createElement(Outlet, null) : React.createElement(Navigate, { to: "/", replace: true });
    return allowed ? React.createElement(React.Fragment, null, children) : null;
};
export default Protected;
