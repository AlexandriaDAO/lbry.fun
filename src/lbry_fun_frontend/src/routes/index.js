import React, { lazy, Suspense } from "react";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router";
import MainLayout from "@/layouts/MainLayout";
import AuthGuard from "@/guards/AuthGuard";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import { ROUTES } from "./routeConfig";
import TopProgressBar from "@/components/TopProgressBar";
import SwapPage from "@/pages/swap";
import SuccessPage from "@/pages/SuccessPage";
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const TokenPage = lazy(() => import("@/pages/tokenPage"));
const router = createBrowserRouter(createRoutesFromElements(React.createElement(Route, { element: React.createElement(AuthGuard, null) },
    React.createElement(Route, { path: "/", element: React.createElement(MainLayout, null) },
        React.createElement(Route, { index: true, element: React.createElement(Suspense, { key: "home", fallback: React.createElement(TopProgressBar, null) },
                React.createElement(TokenPage, null)) }),
        React.createElement(Route, { path: "/token" },
            React.createElement(Route, { path: "success", element: React.createElement(Suspense, { key: "success", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SuccessPage, null)) })),
        React.createElement(Route, { path: "swap" },
            React.createElement(Route, { index: true, element: React.createElement(Suspense, { key: "swap", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "balance", element: React.createElement(Suspense, { key: "swap-balance", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "swap", element: React.createElement(Suspense, { key: "swap-swap", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "topup", element: React.createElement(Suspense, { key: "swap-topup", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "send", element: React.createElement(Suspense, { key: "swap-send", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "receive", element: React.createElement(Suspense, { key: "swap-receive", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "burn", element: React.createElement(Suspense, { key: "swap-burn", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "stake", element: React.createElement(Suspense, { key: "swap-stake", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "redeem", element: React.createElement(Suspense, { key: "swap-redeem", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "history", element: React.createElement(Suspense, { key: "swap-history", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) }),
            React.createElement(Route, { path: "insights", element: React.createElement(Suspense, { key: "swap-insights", fallback: React.createElement(TopProgressBar, null) },
                    React.createElement(SwapPage, null)) })),
        React.createElement(Route, { path: ROUTES.UNAUTHORIZED, element: React.createElement(Suspense, { key: "401", fallback: React.createElement(TopProgressBar, null) },
                React.createElement(UnauthorizedPage, null)) }),
        React.createElement(Route, { path: ROUTES.NOT_FOUND, element: React.createElement(Suspense, { key: "404", fallback: React.createElement(TopProgressBar, null) },
                React.createElement(NotFoundPage, null)) })))));
export const AppRoutes = () => {
    return React.createElement(RouterProvider, { router: router });
};
