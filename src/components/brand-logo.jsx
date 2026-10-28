import React from 'react';
import { cn } from '@/lib/utils';

export const BrandLogo = ({ 
    siteName = (process.env.NEXT_PUBLIC_APP_NAME || 'MI TIENDA'), 
    siteSlogan = (process.env.NEXT_PUBLIC_APP_SLOGAN || 'LICORERA EXCLUSIVA'), 
    isMobile = false, 
    isSplash = false 
}) => {
    const parts = siteName.split(' ');
    
    return (
        <div className={cn(
            "flex items-center group whitespace-nowrap", 
            isMobile ? "scale-75 origin-left" : "",
            isSplash ? "mb-4" : ""
        )}>
            <div className={cn(
                "flex flex-col -space-y-1 sm:-space-y-2 items-center",
                !isMobile && !isSplash ? "text-center" : ""
            )}>
                <span className={cn(
                    "font-black tracking-tighter transition-all duration-500 group-hover:tracking-normal flex items-center flex-nowrap whitespace-nowrap",
                    isMobile ? "text-2xl" : isSplash ? "text-4xl sm:text-6xl" : "text-3xl sm:text-4xl"
                )}>
                    <span className="text-foreground shrink-0 whitespace-nowrap">{parts[0]}</span>
                    {parts.length > 1 && (
                        <span className="text-red-600 italic ml-2 relative shrink-0 whitespace-nowrap inline-block">
                            {parts.slice(1).join(' ')}
                            <span className="absolute -bottom-1 left-0 w-full h-1 bg-red-600/20 -skew-x-12" />
                        </span>
                    )}
                </span>
                <span className={cn(
                    "font-bold tracking-[0.3em] text-muted-foreground uppercase opacity-50 group-hover:opacity-100 transition-opacity whitespace-nowrap",
                    isMobile ? "text-[8px]" : isSplash ? "text-sm sm:text-base mt-2" : "text-[10px]"
                )}>
                    {siteSlogan}
                </span>
            </div>
            {!isMobile && !isSplash && <div className="ml-4 h-10 w-[2px] bg-red-600/20 rotate-12 hidden lg:block" />}
        </div>
    );
};
