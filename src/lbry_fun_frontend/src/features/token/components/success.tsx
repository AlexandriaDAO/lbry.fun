import React from "react";
import GetTokenPools from "@/features/token/components/getTokenPools";


const SuccessToken = () => {

    return (
        <div className="min-h-screen bg-background py-[100px] px-4">
            <div className="container px-2">

                {/* Header */}
                <div className="text-center px-2 pb-10">
                    <h1 className="text-5xl font-bold text-black text-foreground pb-8">Your token has been created <span className="text-[#16A34A]">successfully</span>!</h1>
                   
                </div>
            </div>
            <div className="container px-2">
        
                 <GetTokenPools />
            </div>

        </div>
    );
};

export default SuccessToken;
