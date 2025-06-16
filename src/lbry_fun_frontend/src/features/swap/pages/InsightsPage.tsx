import React from "react";
import Insights from "../components/insights/insights";

const InsightsPage: React.FC = () => {
    return (
        <div>
            <div className='mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5'>
                <h3 className="text-tabsheading 2xl:text-xxltabsheading xl:text-xltabsheading lg:text-lgtabsheading md:text-mdtabsheading sm:text-smtabsheading font-bold">
                    Token Analytics & Insights
                </h3>
            </div>
            <Insights />
        </div>
    );
};

export default InsightsPage;