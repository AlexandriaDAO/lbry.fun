import React from "react";
import TerminalCreateToken from "@/features/token/components/terminal/TerminalCreateToken";
import GetTokenPools from "@/features/token/components/getTokenPools";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { selectActiveTokenView, setActiveTokenView, type TokenPageView } from '@/store/slices/uiSlice';
import { Button } from "@/lib/components/button";

const TokenPage = () => {
  const activeView = useAppSelector(selectActiveTokenView);
  const dispatch = useAppDispatch();

  let contentToRender;
  let contentClassName;

  if (activeView === 'CreateToken') {
    contentToRender = (
      <>
        <Button 
          variant="outline" 
          scale="sm"
          className="mb-6 bg-black text-lime-500 border-white/30 hover:bg-white/10 font-mono"
          onClick={() => dispatch(setActiveTokenView('TokenPools'))}
        >
          <span className="mr-2">&lt;</span> back_to_pools
        </Button>
        <TerminalCreateToken />
      </>
    );
    contentClassName = "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8";
  } else {
    contentToRender = <GetTokenPools />;
    contentClassName = "container px-2";
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
