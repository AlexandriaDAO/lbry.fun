import React from "react";

const SwapContentSkeleton: React.FC = () => {
    return (
        <div>
            <div className="mb-5 2xl:mb-10 xl:mb-7 lg:mb-7 md:mb-6 sm:mb-5">
                <div className="h-8 w-24 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="grid grid-cols-1 2xl:grid-cols-2 xl:grid-cols-2 lg:grid-cols-2 md:grid-cols-1 sm:grid-cols-1">
                <div className="me-0 2xl:me-2 xl:me-2 lg:me-2 md:me-0 sm:me-0 mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-3 sm:mb-3">
                    <div className="block 2xl:flex xl:flex lg:flex md:flex sm:block justify-between mb-5 w-full">
                        {/* ICP Input Card Skeleton */}
                        <div className="bg-card border border-border py-5 px-7 rounded-borderbox me-0 2xl:me-2 xl:me-2 lg:me-2 md:me-2 sm:me-0 w-full 2xl:w-6/12 xl:w-6/12 lg:w-6/12 md:w-6/12 sm:w-full mb-3 2xl:mb-0 xl:mb-0 lg:mb-0 md:mb-0 sm:mb-3 animate-pulse">
                            <div className="flex justify-between mb-5">
                                <div className="h-6 w-12 bg-muted rounded"></div>
                                <div className="h-6 w-20 bg-muted rounded"></div>
                            </div>
                            <div className="flex justify-between">
                                <div className="h-4 w-24 bg-muted rounded"></div>
                                <div className="h-4 w-10 bg-muted rounded"></div>
                            </div>
                        </div>
                        {/* Secondary Token Output Card Skeleton */}
                        <div className="bg-card border border-border py-5 px-7 rounded-borderbox me-0 2xl:ms-2 xl:ms-2 lg:ms-2 md:ms-2 sm:me-0 w-full 2xl:w-6/12 xl:w-6/12 lg:w-6/12 md:w-6/12 sm:w-full animate-pulse">
                            <div className="flex justify-between mb-5 flex-wrap break-all">
                                <div className="h-6 w-16 bg-muted rounded"></div>
                                <div className="h-6 w-20 bg-muted rounded"></div>
                            </div>
                            <div className="flex justify-between">
                                <div className="h-4 w-32 bg-muted rounded"></div>
                            </div>
                        </div>
                    </div>
                    <div className="mb-4">
                        <div className="h-4 w-3/4 bg-muted rounded animate-pulse"></div>
                    </div>
                    <div>
                        <div className="h-12 w-full bg-muted rounded-full animate-pulse mb-6"></div>
                        <div className="flex items-baseline">
                            <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
                        </div>
                    </div>
                </div>
                <div className="border border-muted bg-card py-5 px-5 rounded-2xl ms-3 animate-pulse">
                    <ul className="ps-0">
                        {[1, 2, 3, 4, 5].map((index) => (
                            <li key={index} className="flex justify-between mb-5">
                                <div className="h-4 w-24 bg-muted rounded"></div>
                                <div className="h-4 w-16 bg-muted rounded"></div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default SwapContentSkeleton;