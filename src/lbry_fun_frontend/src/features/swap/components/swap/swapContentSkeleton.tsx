import React from "react";

const SwapContentSkeleton: React.FC = () => {
    return (
        <div className="bg-card border border-border rounded-lg p-6">
            <div className="terminal-header mb-6">
                <span className="terminal-prompt">&gt;</span> <span className="animate-pulse">loading_interface...</span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Swap Form Skeleton */}
                <div>
                    <div className="mb-6">
                        <div className="terminal-header mb-3">
                            <span className="terminal-prompt">&gt;&gt;</span> <span className="animate-pulse">input</span>
                        </div>
                        
                        <div className="bg-black border border-white/30 p-4 mb-3 animate-pulse">
                            <div className="flex justify-between items-center">
                                <span className="terminal-label">icp_amount:</span>
                                <div className="h-4 w-20 bg-gray-700 rounded"></div>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2">
                            <span className="terminal-label">balance:</span>
                            <div className="h-4 w-16 bg-gray-700 rounded animate-pulse"></div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="terminal-header mb-3">
                            <span className="terminal-prompt">&gt;&gt;</span> <span className="animate-pulse">output</span>
                        </div>
                        
                        <div className="bg-black border border-white/30 p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="terminal-label">receive:</span>
                                <div className="h-4 w-24 bg-gray-700 rounded animate-pulse"></div>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="terminal-label">balance:</span>
                                <div className="h-4 w-20 bg-gray-700 rounded animate-pulse"></div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="h-12 w-full bg-gray-700 rounded animate-pulse"></div>
                    </div>
                </div>

                {/* Right Column - Transaction Details Skeleton */}
                <div>
                    <div className="bg-black border border-white/30 p-4 animate-pulse">
                        <div className="terminal-header mb-4">
                            <span className="terminal-prompt">&gt;&gt;</span> transaction_details
                        </div>
                        
                        {[1, 2, 3, 4].map((index) => (
                            <div key={index} className="flex justify-between items-center mb-2">
                                <div className="h-3 w-20 bg-gray-700 rounded"></div>
                                <div className="h-3 w-16 bg-gray-700 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SwapContentSkeleton;