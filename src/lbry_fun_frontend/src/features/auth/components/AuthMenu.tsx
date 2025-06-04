import React from "react";
import {
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
				<div className="w-[42px] h-[42px] border border-white dark:border-gray-700 rounded-full cursor-pointer bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
					<UserCircle size={24} className="text-gray-700 dark:text-gray-300" />
				</div>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" side="bottom" align="end">
				{principal && (
					<DropdownMenuLabel className="text-center truncate">
						{displayPrincipal}
					</DropdownMenuLabel>
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
