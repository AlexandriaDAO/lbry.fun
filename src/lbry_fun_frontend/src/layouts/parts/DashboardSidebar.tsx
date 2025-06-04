import React from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { Boxes, Home, LayoutList, /*Library, Upload,*/ Database } from "lucide-react";
import { NavLink } from "react-router-dom";
import AuthNavigation from "./AuthNavigation";
import { RootState } from "@/store";

const DashboardSidebar = () => {
    // const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth); // user object is not used directly anymore

    return (
        <div className="h-full flex flex-col justify-between p-4">
            <div className="flex flex-col gap-8">
                {/* {isAuthenticated && principal === 'your-librarian-principal-id' && // Example of a new librarian check
                    <NavLink
                        to="/librarian"
                        end
                        className="px-4 py-2 rounded-full text-center transition-all text-warning-foreground bg-warning border border-gray-300 hover:text-primary hover:border hover:border-ring"
                    >
                        Librarian
                    </NavLink>
                } */}
                <div className="flex flex-col gap-3">
                    {/* Navigation links seem fine as they don't directly depend on user object details */}
                    <NavLink
                        to="/dashboard"
                        end
                        className={({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        `}
                    >
                        <Home size={18} />
                        <span>Home</span>
                    </NavLink>

                    <NavLink
                        to="wallets" // Assuming this is /dashboard/wallets
                        end
                        className={({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        `}
                    >
                        <LayoutList size={18}/>
                        <span>My Wallets</span>
                    </NavLink>

                    <NavLink
                        to="/dashboard/asset-sync"
                        end
                        className={({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        `}
                    >
                        <Database size={18}/>
                        <span>ICP Asset Sync</span>
                    </NavLink>

                    <NavLink
                        to="/dashboard/arweave-assets"
                        end
                        className={({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        `}
                    >
                        <Boxes size={18} />
                        <span>Arweave Assets</span>
                    </NavLink>

                    <NavLink
                        to="/dashboard/icp-assets"
                        end
                        className={({ isActive }) => `
                            px-4 py-2 rounded-full flex justify-start gap-2 items-center transition-all border border-border/75
                            ${isActive ? 'text-primary-foreground bg-primary' : 'text-primary/75 bg-muted hover:border-border hover:text-primary'}
                        `}
                    >
                        <Boxes size={18} />
                        <span>ICP Assets</span>
                    </NavLink>

                </div>
            </div>

            <AuthNavigation />
        </div>
    );
};

export default DashboardSidebar;