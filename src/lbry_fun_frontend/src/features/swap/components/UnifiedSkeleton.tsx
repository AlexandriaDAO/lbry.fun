import React from "react";
import { LoaderCircle } from "lucide-react";

interface UnifiedSkeletonProps {
    variant: 'terminal' | 'card' | 'form' | 'table' | 'swap' | 'stake' | 'balance';
    rows?: number;
    className?: string;
}

const UnifiedSkeleton: React.FC<UnifiedSkeletonProps> = ({ variant, rows = 3, className = "" }) => {
    // Terminal skeleton variant (replaces TerminalSkeleton)
    if (variant === 'terminal') {
        return (
            <div className={`terminal-container ${className}`}>
                <div className="terminal-header mb-6">
                    <span className="terminal-prompt">&gt;</span> 
                    <span className="animate-pulse">loading_terminal...</span>
                </div>
                
                <div className="flex items-center justify-center py-20">
                    <LoaderCircle className="animate-spin text-primary" size={48} />
                </div>
                
                <div className="terminal-footer mt-6 text-center">
                    <span className="text-muted-foreground text-xs">
                        initializing components...
                    </span>
                </div>
            </div>
        );
    }

    // Card skeleton variant (generic card loading)
    if (variant === 'card') {
        return (
            <div className={`bg-card border border-border rounded-lg p-6 animate-pulse ${className}`}>
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="mb-3 last:mb-0">
                        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                    </div>
                ))}
            </div>
        );
    }

    // Form skeleton variant
    if (variant === 'form') {
        return (
            <div className={`space-y-4 ${className}`}>
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="h-3 bg-gray-700 rounded w-1/4 mb-2"></div>
                        <div className="h-10 bg-gray-700 rounded"></div>
                    </div>
                ))}
                <div className="h-12 bg-gray-700 rounded animate-pulse"></div>
            </div>
        );
    }

    // Table skeleton variant
    if (variant === 'table') {
        return (
            <div className={`border border-muted rounded-lg p-4 animate-pulse ${className}`}>
                <div className="grid grid-cols-5 gap-4 mb-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-5 bg-muted rounded"></div>
                    ))}
                </div>
                {Array.from({ length: rows }, (_, row) => (
                    <div key={row} className="grid grid-cols-5 gap-4 py-3 border-t border-muted">
                        {[1, 2, 3, 4, 5].map((col) => (
                            <div key={col} className="h-4 bg-muted rounded"></div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    // Swap skeleton variant (from original Skeleton.tsx)
    if (variant === 'swap') {
        return (
            <div className={`bg-card border border-border rounded-lg p-6 ${className}`}>
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
    }

    // Stake skeleton variant (from original Skeleton.tsx)
    if (variant === 'stake') {
        return (
            <div className={className}>
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
                                {[1, 2, 3].map((i) => (
                                    <li key={i} className='mb-4 last:mb-0'>
                                        <div className='flex justify-between'>
                                            <div className="h-5 w-36 bg-muted rounded"></div>
                                            <div className="h-5 w-24 bg-muted rounded"></div>
                                        </div>
                                    </li>
                                ))}
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
        );
    }

    // Balance skeleton variant (from original Skeleton.tsx)
    if (variant === 'balance') {
        return (
            <div className={`w-full ${className}`}>
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
    }

    return null;
};

export default UnifiedSkeleton;