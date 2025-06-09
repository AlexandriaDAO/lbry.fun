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
					<Route path="balance" element={<Suspense key="swap-balance" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="swap" element={<Suspense key="swap-swap" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="topup" element={<Suspense key="swap-topup" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="send" element={<Suspense key="swap-send" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="receive" element={<Suspense key="swap-receive" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="burn" element={<Suspense key="swap-burn" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="stake" element={<Suspense key="swap-stake" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="redeem" element={<Suspense key="swap-redeem" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="history" element={<Suspense key="swap-history" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					<Route path="insights" element={<Suspense key="swap-insights" fallback={<TopProgressBar />}><SwapPage /></Suspense>} />
					{/* <Route path="transaction" element={<Suspense key="transaction" fallback={<TopProgressBar />}><DetailTransaction /></Suspense>} /> */}
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
