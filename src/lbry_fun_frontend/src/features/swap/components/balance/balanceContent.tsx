import React, { useEffect } from "react";

import PrimaryBalanceCard from "./primaryBalanceCard";
import { useAppDispatch } from "@/store/hooks/useAppDispatch";
import { useAppSelector } from "@/store/hooks/useAppSelector";

import getAccountPrimaryBalance from "../../thunks/primaryIcrc/getAccountPrimaryBalance";
import SecondaryBalanceCard from "./secondaryBalanceCard";
import getSecondaryBalance from "../../thunks/secondaryIcrc/getSecondaryBalance";
import { RootState } from "@/store";

const BalanceContent: React.FC = () => {
    const dispatch = useAppDispatch();
    const { principal, isAuthenticated } = useAppSelector((state: RootState) => state.auth);

    useEffect(() => {
        if (isAuthenticated && principal) {
            dispatch(getAccountPrimaryBalance(principal));
            dispatch(getSecondaryBalance(principal));
        }
    }, [isAuthenticated, principal, dispatch]);

    return (
        <>
            <div>
                <div className='mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5'>
                    <h3 className="text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold">Balance</h3>
                </div>
                <div className="flex md:flex-row flex-col">
                    <PrimaryBalanceCard />
                    <SecondaryBalanceCard />
                </div>
            </div>
        </>
    );
};
export default BalanceContent;
