import React, { lazy, Suspense } from "react";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router";


import MainLayout from "@/layouts/MainLayout";
import AuthGuard from "@/guards/AuthGuard";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import { ROUTES } from "./routeConfig";
import TopProgressBar from "@/components/TopProgressBar";
import SwapPage from "@/pages/swap";
import SuccessPage from "@/pages/SuccessPage";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const NotFoundPage = lazy(()=>import("@/pages/NotFoundPage"));
const TokenPage = lazy(() => import("@/pages/tokenPage"));

const router = createBrowserRouter(
	createRoutesFromElements(
		<Route element={<AuthGuard />} errorElement={<RouteErrorBoundary />}>
			<Route path={"/"} element={<MainLayout />}>
				<Route index element={<Suspense key="home" fallback={<TopProgressBar />}><TokenPage /></Suspense>} />
				<Route path="/token">
				<Route path="success" element={<Suspense key="success" fallback={<TopProgressBar />}><SuccessPage /></Suspense>} />


				</Route>
				<Route path="swap">
					<Route index element={<Suspense key="swap" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="trade" element={<Suspense key="swap-trade" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="stake" element={<Suspense key="swap-stake" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="analytics" element={<Suspense key="swap-analytics" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
				</Route>

				<Route path={ROUTES.UNAUTHORIZED} element={<Suspense key="401" fallback={<TopProgressBar />}><UnauthorizedPage /></Suspense>} />
				<Route path={ROUTES.NOT_FOUND} element={<Suspense key="404" fallback={<TopProgressBar />}><NotFoundPage /></Suspense>} />
			</Route>
			
		</Route>
	)
);

export const AppRoutes = () => {
	return <RouterProvider router={router} />;
}
