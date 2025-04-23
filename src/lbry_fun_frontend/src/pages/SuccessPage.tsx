import React, { useEffect, useState } from "react";
import CreateTokenForm from "@/features/token/components/createTokenForm";
import GetTokenPools from "@/features/token/components/getTokenPools";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";
import getIcpBal from "@/features/icp-ledger/thunks/getIcpBal";
import UpcommingTokens from "@/features/token/components/upcommingTokens";
import { Button, Form, Input } from "antd/es";
import { Label } from "@/lib/components/label";


import { Textarea } from "@/lib/components/textarea";

const SuccessPage = () => {
    const dispatch = useAppDispatch();
    const icp = useAppSelector((state) => state.icpLedger);
    const { user } = useAppSelector((state) => state.auth);
    const [supply, setSupply] = useState(1000);
    const maxSupply = 10000;

    useEffect(() => {
        if (user?.principal) {
            dispatch(getIcpBal(user.principal));
        }
    }, [user]);
    const handleSliderChange = (e: any) => {
        setSupply(Number(e.target.value));
    };

    return (
        <div className="min-h-screen bg-background py-[100px] px-4">
            <div className="container px-2">

                {/* Header */}
                <div className="text-center px-2 pb-10">
                    <h1 className="text-5xl font-bold text-black text-foreground pb-8">Your token has been created <span className="text-[#16A34A]">successfully</span>!</h1>
                    <div className="text-center flex items-center justify-center">
                        <Button

                            className="bg-transparent lg:h-12 md:h-10 sm:h-10 xs:h-10 lg:px-7 md:px-5 sm:px-4 xs:px-2 text-[#0F172A] lg:text-lg md:text-base text-sm border border-2 border-[#353535] rounded-xl hover:bg-[#0F172A] hover:text-[#fff] dark:bg-[#FFFFFF] dark:border-[#FFFFFF] dark:text-[#0F1F2A] hover:dark:border-[#FFFFFF] hover:dark:text-[#FFFFFF] hover:dark:bg-transparent min-w-[300px] me-4"
                        >
                            Copy Token Info
                        </Button>
                        <Button

                            className="bg-[#0F172A] lg:h-12 md:h-10 sm:h-10 xs:h-10 lg:px-7 md:px-5 sm:px-4 xs:px-2 text-white lg:text-lg md:text-base text-sm border border-2 border-[#353535] rounded-xl hover:bg-white hover:text-[#353535] dark:bg-[#FFFFFF] dark:border-[#FFFFFF] dark:text-[#0F1F2A] hover:dark:border-[#FFFFFF] hover:dark:text-[#FFFFFF] hover:dark:bg-transparent min-w-[300px] "
                        >
                            Create New Token
                        </Button>
                    </div>
                </div>
            </div>
            <div className="container px-2">
                <h2 className="text-2xl font-bold mb-4 text-foreground">Token Pools</h2>
                 <GetTokenPools />
            </div>

        </div>
    );
};

export default SuccessPage;
