import React, { useState } from "react";
import CreateTokenForm from "@/features/token/components/createTokenForm";
import GetTokenPools from "@/features/token/components/getTokenPools";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import { Content } from "@radix-ui/react-dialog/dist";


const TokenPage = () => {
  const [activeTab, setActiveTab] = useState({ id: "CreateToken", label: "Create Token", content: <CreateTokenForm />, className: "max-w-3xl mx-auto space-y-8" },
  );

  const tabs = [
    { id: "CreateToken", label: "Create Token", content: <CreateTokenForm />, className: "max-w-3xl mx-auto space-y-8" },
    { id: "TokenPools", label: "Token Pools", content: <GetTokenPools />, className: "container px-2" },
  ];




  return (
    <div className="min-h-screen bg-background py-10 px-4">

      <div className={activeTab.className}>
        <div className="flex border-b border-gray-200 mb-6 justify-center bg-[#E4E4E7] dark:bg-[#42403A] max-w-[370px] m-auto rounded-2xl p-[10px]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center transition-colors duration-300 text-base font-semibold leading-6 min-w-24 h-11 border dark:border-gray-700 border-gray-400 rounded-2xl hover:bg-[#5555FF] hover:text-white dark:hover:bg-white dark:hover:text-black px-5 m-0 whitespace-nowrap mr-3 ${
                activeTab.id === tab.id
                  ? '!bg-[#5555FF] text-white 2xl:text-xl dark:bg-white dark:text-black'
                  : ''
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>


        {activeTab.content}

      </div>


    </div>
  );
};

export default TokenPage;
