import React from "react";
import { useIcpBalance } from "@/hooks/useIcpBalance";

const UserICPBalance = () => {
    const { balance } = useIcpBalance();

    return (<>
        <div className="pb-5">
            <div className="py-4 border-b-2 border-b-border-accent mb-4 px-2 md:flex md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-bold mb-2 text-foreground">Balance</h2>
                    <p className="text-lg text-black font-semibold text-foreground">
                        <span className="text-constructive">{balance}</span> ICP
                    </p>
                </div>

                <div className="mt-4 md:mt-0 md:ml-6 flex items-start">
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        strokeWidth={1.5} 
                        stroke="currentColor" 
                        className="flex-shrink-0 w-5 h-5 text-blue-500 mr-2"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" 
                        />
                    </svg>
                    <div>
                        <p className="text-sm text-gray-300 font-semibold">Notice:</p>
                        <p className="text-xs text-gray-400">
                            <strong>5 ICP</strong> is required to create new tokens.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </>);
}
export default UserICPBalance;
