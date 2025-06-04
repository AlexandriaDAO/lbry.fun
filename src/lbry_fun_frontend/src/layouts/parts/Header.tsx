import React, { Suspense, useState } from "react";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import Logo from "@/components/Logo";
import Tabs from "@/components/Tabs";
import { useIdentity } from "@/hooks/useIdentity";
import { ModeToggle } from "@/lib/components/mode-toggle";
import AuthMenu from "@/features/auth/components/AuthMenu";

export const Entry = () => {
	const { isInitializing, isLoggingIn } = useIdentity();
	const { isAuthenticated, isLoading: authLoading, error: authError } = useAppSelector((state) => state.auth);
	const { loading: loginUiLoading, error: loginUiError } = useAppSelector((state) => state.login);
	
	const isLoading = isInitializing || isLoggingIn || authLoading || loginUiLoading;

	return (
		<div className="flex items-center gap-2">
			<ModeToggle />
			<AuthMenu />
		</div>
	);
};

const Header = () => {
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	const toggleMenu = () => {
		setIsMenuOpen(!isMenuOpen);
	};

	return (
		<header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-14 max-w-screen-2xl items-center">
				<Logo />
				<div className="hidden md:flex flex-1 items-center justify-between ml-4">
					<Tabs />
					<nav className="flex items-center">
						<Entry />
					</nav>
				</div>
				<div className="md:hidden flex flex-1 justify-end items-center">
					<button onClick={toggleMenu} className="p-2">
						{isMenuOpen ? (
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						) : (
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
								<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
							</svg>
						)}
					</button>
				</div>
			</div>
			{isMenuOpen && (
				<div className="md:hidden">
					<nav className="flex flex-col items-center px-2 py-4 border-t border-border/40">
						<Tabs />
						<div className="mt-4">
							<Entry />
						</div>
					</nav>
				</div>
			)}
		</header>
	);
};

export default Header;
