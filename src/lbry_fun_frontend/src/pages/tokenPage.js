import React from "react";
import CreateTokenForm from "@/features/token/components/createTokenForm";
import GetTokenPools from "@/features/token/components/getTokenPools";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { selectActiveTokenPageTab } from '@/store/slices/uiSlice';
const TokenPage = () => {
    const activeTabId = useAppSelector(selectActiveTokenPageTab);
    let contentToRender;
    let contentClassName;
    if (activeTabId === 'CreateToken') {
        contentToRender = React.createElement(CreateTokenForm, null);
        contentClassName = "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8";
    }
    else if (activeTabId === 'TokenPools') {
        contentToRender = React.createElement(GetTokenPools, null);
        contentClassName = "container px-2";
    }
    else {
        contentToRender = React.createElement(CreateTokenForm, null);
        contentClassName = "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8";
    }
    return (React.createElement("div", { className: "min-h-screen bg-background py-10 px-4" },
        React.createElement("div", { className: contentClassName }, contentToRender)));
};
export default TokenPage;
