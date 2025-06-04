import React from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { Navigate, Outlet } from "react-router";

interface ProtectedProps {
	children?: React.ReactNode;
	route?: boolean;
}

const Protected = ({ children, route = false }: ProtectedProps) => {
	const { isAuthenticated, isLoading, isInitialized } = useAppSelector((state) => state.auth);

	if (isLoading || !isInitialized) {
		return null;
	}

	const allowed = isAuthenticated;

	if(route) return allowed ? <Outlet /> : <Navigate to="/" replace />;

	return allowed ? <>{children}</> : null;
};

export default Protected;