import React, { useState } from 'react';

interface TooltipProps {
    content: string;
    children?: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
    useIcon?: boolean; // If true, renders a default '?' icon
}

export const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = 'top',
    className = '',
    useIcon = false
}) => {
    const [isVisible, setIsVisible] = useState(false);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-x-transparent border-b-transparent border-4',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-x-transparent border-t-transparent border-4',
        left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-y-transparent border-r-transparent border-4',
        right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-y-transparent border-l-transparent border-4'
    };

    return (
        <div
            className={`relative inline-flex items-center ${className}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {useIcon ? (
                <div className="w-4 h-4 rounded-full border border-slate-500/50 text-slate-500 flex items-center justify-center cursor-help hover:bg-slate-500/20 hover:text-slate-300 transition-colors">
                    <span className="text-[10px] font-black">?</span>
                </div>
            ) : children}

            <div className={`
        absolute z-[60] w-max max-w-[200px] px-3 py-2 bg-slate-800 rounded-lg shadow-xl border border-white/10 text-xs text-slate-200 text-center font-medium pointer-events-none transition-all duration-200 ease-out origin-center
        ${positionClasses[position]}
        ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
      `}>
                {content}
                {/* Arrow */}
                <div className={`absolute w-0 h-0 ${arrowClasses[position]}`}></div>
            </div>
        </div>
    );
};
