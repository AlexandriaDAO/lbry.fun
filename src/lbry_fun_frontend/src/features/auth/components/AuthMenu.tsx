import React from "react";
import {
	Copy,
	LogIn,
	LogOut,
	UserCircle,
} from "lucide-react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/lib/components/dropdown-menu";
import { useLogout } from "@/hooks/useLogout";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useIdentity } from "@/hooks/useIdentity";
import { Button } from "@/lib/components/button";
import { Skeleton } from "@/lib/components/skeleton";
import { principalToString } from "@/utils/principal";
import { toast } from "sonner";

export default function AuthMenu() {
	const logout = useLogout();
	const { login, isLoggingIn, identity } = useIdentity();
	const { 
		isAuthenticated, 
		principal, 
		isLoading: authReduxLoading, 
		isInitialized: authReduxInitialized 
	} = useAppSelector(state => state.auth);

	const handleLogin = () => {
		if (login) {
			login();
		}
	};

	const handleCopyPrincipal = () => {
		if (principal) {
			navigator.clipboard.writeText(principal);
			toast.success("Principal copied to clipboard!");
		}
	}

	const isMenuLoading = !authReduxInitialized || authReduxLoading || isLoggingIn;

	if (isMenuLoading) {
		return <Skeleton className="h-[42px] w-[42px] rounded-full" />;
	}

	if (!isAuthenticated) {
		return (
			<Button 
				onClick={handleLogin} 
				variant="outline" 
				className="rounded-full p-2 h-[42px] w-[42px]"
				disabled={!login}
			>
				<LogIn size={18} />
			</Button>
		);
	}

	const displayPrincipal = principal ? principalToString(principal) : "Principal ID";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<div className="w-[42px] h-[42px] border border-white border-gray-700 rounded-full cursor-pointer bg-gray-200 bg-gray-800 flex items-center justify-center">
					<UserCircle size={24} className="text-gray-700 text-gray-300" />
				</div>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" side="bottom" align="end">
				{principal && (
					<DropdownMenuItem className="cursor-pointer" onClick={handleCopyPrincipal}>
						<span className="truncate">{displayPrincipal}</span>
						<Copy className="ml-auto h-4 w-4" />
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem className="cursor-pointer" onClick={logout}>
					<LogOut className="mr-2 h-4 w-4" />
					<span>Log out</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
