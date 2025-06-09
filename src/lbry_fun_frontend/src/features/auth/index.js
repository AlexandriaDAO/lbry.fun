import React from "react";
import AuthMenu from "./components/AuthMenu";
// import ETHAccount from "./components/ETHAccount";
// import useAuth from "@/hooks/useAuth"; // This hook might need review/removal later
// import ICPAccount from "./components/ICPAccount";
// import SOLAccount from "./components/SOLAccount";
const Auth = () => {
    // const {provider} = useAuth(); // Logic related to provider might be obsolete
    return (React.createElement("div", { className: "flex gap-2 sm:justify-center xs:justify-start items-center" },
        React.createElement(AuthMenu, null)));
};
export default Auth;
