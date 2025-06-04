import React from "react";
import CreateTokenForm from "@/features/token/components/createTokenForm";
import GetTokenPools from "@/features/token/components/getTokenPools";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { selectActiveTokenPageTab, type TokenPageActiveTab } from '@/store/slices/uiSlice';

const TokenPage = () => {
  const activeTabId = useAppSelector(selectActiveTokenPageTab);

  let contentToRender;
  let contentClassName;

  if (activeTabId === 'CreateToken') {
    contentToRender = <CreateTokenForm />;
    contentClassName = "max-w-3xl mx-auto space-y-8";
  } else if (activeTabId === 'TokenPools') {
    contentToRender = <GetTokenPools />;
    contentClassName = "container px-2";
  } else {
    contentToRender = <CreateTokenForm />;
    contentClassName = "max-w-3xl mx-auto space-y-8";
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className={contentClassName}>
        {contentToRender}
      </div>
    </div>
  );
};

export default TokenPage;
