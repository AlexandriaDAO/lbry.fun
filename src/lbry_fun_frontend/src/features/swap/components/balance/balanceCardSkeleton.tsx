import React from "react";

const BalanceCardSkeleton: React.FC = () => {
    return (
        <div className="w-full">
            <div className='bg-primary py-5 px-7 me-3 rounded-3xl mb-5 animate-pulse'>
                <div className='flex justify-between items-center mb-3'>
                    <div>
                        <div className='h-7 w-32 bg-primary-foreground/20 rounded mb-2'></div>
                        <div className='h-4 w-20 bg-primary-foreground/20 rounded'></div>
                    </div>
                    <div>
                        <div className="w-12 h-12 bg-primary-foreground/20 rounded-full"></div>
                    </div>
                </div>
                <div className="flex justify-between items-center mb-3">
                    <div className='h-5 w-16 bg-primary-foreground/20 rounded'></div>
                    <div className='h-5 w-5 bg-primary-foreground/20 rounded'></div>
                </div>
                <div className="flex text-center justify-between">
                    <div className='h-7 w-24 bg-primary-foreground/20 rounded'></div>
                    <div className='h-5 w-16 bg-primary-foreground/20 rounded'></div>
                </div>
            </div>
        </div>
    );
};

export default BalanceCardSkeleton;