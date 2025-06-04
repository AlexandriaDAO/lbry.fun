import React, { useEffect } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { RootState } from "@/store";
import Loading from "@/components/Loading";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { 
	setAuthSuccess, 
	clearAuth, 
	setAuthLoading, 
	setAuthInitialized 
} from "@/features/auth/authSlice";

const AuthGuard = () => {
	const { 
		identity, 
		isInitializing: iiInitializing, 
		isLoggingIn: iiLoggingIn 
	} = useIdentity();
	const { 
		isAuthenticated, 
		principal, 
		isLoading: authReduxLoading,
		isInitialized: authInitialized 
	} = useAppSelector((state: RootState) => state.auth);
	const dispatch = useAppDispatch();
	const location = useLocation();

	useEffect(() => {
		if (iiLoggingIn) {
			if (!authReduxLoading) {
				dispatch(setAuthLoading(true));
			}
		}
	}, [iiLoggingIn, authReduxLoading, dispatch]);

	useEffect(() => {
		if (iiInitializing) {
			return;
		}

		const principalIdFromII = identity?.getPrincipal().toString();
		const isActuallyAuthenticated = !!(principalIdFromII && principalIdFromII !== "2vxsx-fae");

		if (!authInitialized) {
			if (!authReduxLoading && !iiLoggingIn) {
				dispatch(setAuthLoading(true)); 
			}
			
			if (isActuallyAuthenticated) {
				dispatch(setAuthSuccess(principalIdFromII!)); 
			} else {
				dispatch(clearAuth()); 
			}
			dispatch(setAuthInitialized(true));
			
			const stillLoadingAfterInit = dispatch((_, getState) => getState().auth.isLoading);
			if (stillLoadingAfterInit && !iiLoggingIn) {
				dispatch(setAuthLoading(false));
			}

		} else {
			if (isActuallyAuthenticated) {
				if (!isAuthenticated || principal !== principalIdFromII) {
					dispatch(setAuthSuccess(principalIdFromII!));
				}
			} else { 
				if (isAuthenticated) {
					dispatch(clearAuth());
				}
			}
			
			if (authReduxLoading && !iiLoggingIn) {
				dispatch(setAuthLoading(false));
			}
		}
	}, [
		identity, 
		iiInitializing, 
		iiLoggingIn, 
		isAuthenticated, 
		principal, 
		authInitialized, 
		authReduxLoading, 
		dispatch,
		location.pathname 
	]);

	if (iiInitializing || !authInitialized || authReduxLoading) {
		return <Loading />;
	}

	if (!isAuthenticated && location.pathname !== "/") { 
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
};

export default AuthGuard;