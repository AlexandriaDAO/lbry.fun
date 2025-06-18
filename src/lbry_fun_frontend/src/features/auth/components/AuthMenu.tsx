import React from "react";
import {
	Copy,
	LogIn,
	LogOut,
} from "lucide-react";

import { useLogout } from "@/hooks/useLogout";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useIdentity } from "@/hooks/useIdentity";
import { Button } from "@/lib/components/button";
import { Skeleton } from "@/lib/components/skeleton";
import { principalToString } from "@/utils/principal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIcpBalance } from "@/hooks/useIcpBalance";

export default function AuthMenu() {
	const logout = useLogout();
	const { login, isLoggingIn, identity } = useIdentity();
	const { 
		isAuthenticated, 
		principal, 
		isLoading: authReduxLoading, 
		isInitialized: authReduxInitialized 
	} = useAppSelector(state => state.auth);
	const { balance } = useIcpBalance();

	const handleLogin = () => {
		if (login) {
			login();
		}
	};

	const handleCopyPrincipal = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (principal) {
			navigator.clipboard.writeText(principal);
			toast.success("Principal ID copied!");
		}
	}

	const isMenuLoading = !authReduxInitialized || authReduxLoading || isLoggingIn;

	if (isMenuLoading) {
		return <Skeleton className="h-10 w-48 rounded-full" />;
	}

	if (!isAuthenticated) {
		return (
			<Button 
				onClick={handleLogin} 
				variant="outline" 
				className="rounded-full px-4 py-2 h-10 flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
				disabled={!login}
			>
				<LogIn size={16} />
				<span className="text-sm font-medium">Login</span>
			</Button>
		);
	}

	const displayPrincipal = principal ? principalToString(principal) : "";

	return (
		<div className="flex items-center gap-2">
			<div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-secondary/30 border border-border/50">
				<div className="flex flex-col items-end">
					<span className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance</span>
					<span className="text-sm font-semibold text-foreground">
						{balance || "0.0000"} ICP
					</span>
				</div>
				<div className="w-px h-8 bg-border/50" />
				<button
					onClick={handleCopyPrincipal}
					className="group flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
					title={`Copy Principal ID: ${principal}`}
				>
					<span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
						{displayPrincipal}
					</span>
					<Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
				</button>
			</div>
			<Button
				onClick={logout}
				variant="outline"
				size="sm"
				className="rounded-full px-4 py-2 h-10 flex items-center gap-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
			>
				<LogOut size={16} />
				<span className="text-sm font-medium">Logout</span>
			</Button>
		</div>
	);
}
