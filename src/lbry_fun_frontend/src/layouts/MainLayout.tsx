import React, { ReactNode, useEffect } from "react";
import BaseLayout from "./BaseLayout";
import TerminalHeader from "./parts/TerminalHeader";
import { Outlet } from "react-router";
// Define the type for the component's props

const MainLayout = () => {
	return (
		<>
			<TerminalHeader />
			<Outlet />
		</>
	);
};

export default MainLayout;
