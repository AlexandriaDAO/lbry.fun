import React from "react";
import StakeContent from "../components/stake/stakeContent";
import StakeInfo from "../components/stake/stakeInfo";
import ClaimReward from "../components/stake/claimReward";
import Unstake from "../components/stake/unstake";

const StakePage: React.FC = () => {
    return (
        <div>
            <div className='mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5'>
                <h3 className="text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold">
                    Stake Primary Tokens
                </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <StakeContent />
                    <ClaimReward />
                    <Unstake />
                </div>
                <div>
                    <StakeInfo />
                </div>
            </div>
        </div>
    );
};

export default StakePage;