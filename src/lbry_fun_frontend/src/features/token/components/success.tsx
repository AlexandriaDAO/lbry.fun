import React, { useEffect, useState } from "react";
import GetTokenPools from "@/features/token/components/getTokenPools";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import { Button, Form, Input } from "antd/es";
import UpcommingToken from "./upcommingTokens";

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
                <h2 className="text-2xl font-bold mb-4 text-foreground">All Tokens </h2>
                 <GetTokenPools />
            </div>

        </div>
    );
};

export default SuccessToken;
