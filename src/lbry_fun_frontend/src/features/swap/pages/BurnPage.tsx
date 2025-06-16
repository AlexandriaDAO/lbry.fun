import React from "react";
import BurnContent from "../components/burn/burnContent";
import BurnInfo from "../components/burn/burnInfo";

const BurnPage: React.FC = () => {
    return (
        <div>
            <div className='mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5'>
                <h3 className="text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold">
                    Burn Secondary for Primary + ICP
                </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BurnContent />
                <BurnInfo />
            </div>
        </div>
    );
};

export default BurnPage;