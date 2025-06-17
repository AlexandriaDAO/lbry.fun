import React from "react";

import PrimaryBalanceCard from "./primaryBalanceCard";
import SecondaryBalanceCard from "./secondaryBalanceCard";
import { useSwapData } from "../../providers/SwapDataProvider";

const BalanceContent: React.FC = () => {
    const { isSwapReady } = useSwapData();

    // Data is already loaded by SwapDataProvider
    // No need to fetch here anymore

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
