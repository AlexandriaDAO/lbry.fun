import React from "react";
import { Boxes, Home, LayoutList, /*Library, Upload,*/ Database } from "lucide-react";
import { NavLink } from "react-router-dom";
import AuthNavigation from "./AuthNavigation";
const DashboardSidebar = () => {
    // const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth); // user object is not used directly anymore
    return (React.createElement("div", { className: "h-full flex flex-col justify-between p-4" },
        React.createElement("div", { className: "flex flex-col gap-8" },
            React.createElement("div", { className: "flex flex-col gap-3" },
                React.createElement(NavLink, { to: "/dashboard", end: true, className: ({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        ` },
                    React.createElement(Home, { size: 18 }),
                    React.createElement("span", null, "Home")),
                React.createElement(NavLink, { to: "wallets" // Assuming this is /dashboard/wallets
                    , end: true, className: ({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        ` },
                    React.createElement(LayoutList, { size: 18 }),
                    React.createElement("span", null, "My Wallets")),
                React.createElement(NavLink, { to: "/dashboard/asset-sync", end: true, className: ({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        ` },
                    React.createElement(Database, { size: 18 }),
                    React.createElement("span", null, "ICP Asset Sync")),
                React.createElement(NavLink, { to: "/dashboard/arweave-assets", end: true, className: ({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        ` },
                    React.createElement(Boxes, { size: 18 }),
                    React.createElement("span", null, "Arweave Assets")),
                React.createElement(NavLink, { to: "/dashboard/icp-assets", end: true, className: ({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        ` },
                    React.createElement(Boxes, { size: 18 }),
                    React.createElement("span", null, "ICP Assets")))),
        React.createElement(AuthNavigation, null)));
};
export default DashboardSidebar;
