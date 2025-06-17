import React from "react";

const StakeContentSkeleton: React.FC = () => {
    return (
        <>
            <div>
                <div className='grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 mb-7'>
                    <div className='stake me-2'>
                        <div className="mb-4">
                            <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
                        </div>
                        {/* Staked Info Card Skeleton */}
                        <div className='border border-muted bg-card py-5 px-7 rounded-borderbox mb-3 animate-pulse'>
                            <div className='flex justify-between mb-5'>
                                <div className="h-7 w-20 bg-muted rounded"></div>
                                <div className="h-7 w-32 bg-muted rounded"></div>
                            </div>
                            <ul className='ps-0'>
                                <li className='mb-4'>
                                    <div className='flex justify-between'>
                                        <div className="h-5 w-36 bg-muted rounded"></div>
                                        <div className='text-right'>
                                            <div className='flex flex-col items-end'>
                                                <div className="h-5 w-24 bg-muted rounded mb-1"></div>
                                                <div className="h-4 w-28 bg-muted rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                                <li className='mb-4'>
                                    <div className='flex justify-between'>
                                        <div className="h-5 w-48 bg-muted rounded"></div>
                                        <div className="h-5 w-24 bg-muted rounded"></div>
                                    </div>
                                </li>
                                <li>
                                    <div className='flex justify-between'>
                                        <div className="h-5 w-20 bg-muted rounded"></div>
                                        <div className="h-5 w-16 bg-muted rounded"></div>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className='flex items-center mb-3'>
                            <div className="h-7 w-32 bg-muted rounded animate-pulse"></div>
                        </div>
                        {/* Stake Amount Input Skeleton */}
                        <div className='border border-muted bg-card py-8 px-5 rounded-borderbox mb-7 animate-pulse'>
                            <div className='mb-3'>
                                <div className='flex justify-between mb-5'>
                                    <div className="h-7 w-20 bg-muted rounded"></div>
                                    <div className="h-7 w-24 bg-muted rounded"></div>
                                </div>
                                <div className='flex justify-between'>
                                    <div className='flex items-center'>
                                        <div className="h-5 w-48 bg-muted rounded"></div>
                                        <div className='w-5 h-5 bg-muted rounded-full ml-2'></div>
                                    </div>
                                    <div className="h-5 w-10 bg-muted rounded"></div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="h-12 w-full bg-muted rounded-full animate-pulse mb-6"></div>
                            <div className="flex items-baseline">
                                <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Staked Info Table Skeleton */}
                <div className="overflow-x-auto lg:overflow-x-auto">
                    <div className="min-w-[640px]">
                        <div className="mb-5">
                            <div className="h-8 w-32 bg-muted rounded animate-pulse"></div>
                        </div>
                        <div className="border border-muted rounded-lg p-4 animate-pulse">
                            <div className="grid grid-cols-5 gap-4 mb-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="h-5 bg-muted rounded"></div>
                                ))}
                            </div>
                            {[1, 2, 3].map((row) => (
                                <div key={row} className="grid grid-cols-5 gap-4 py-3 border-t border-muted">
                                    {[1, 2, 3, 4, 5].map((col) => (
                                        <div key={col} className="h-4 bg-muted rounded"></div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default StakeContentSkeleton;