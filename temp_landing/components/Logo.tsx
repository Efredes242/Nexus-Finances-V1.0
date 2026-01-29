
import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => {
  return (
    <div className={`relative flex items-center justify-center ${className} group`}>
      {/* Outer Glow Ring */}
      <div className="absolute inset-0 rounded-full border-2 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.5)] group-hover:shadow-[0_0_20px_rgba(59,130,246,0.8)] transition-all"></div>
      <div className="absolute inset-[1px] rounded-full border border-blue-400/10"></div>
      
      {/* The N + Checkmark Icon */}
      <svg 
        viewBox="0 0 100 100" 
        className="w-full h-full p-2.5 relative z-10 overflow-visible"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main N Shape */}
        <path 
          d="M25 75V25H38L62 60V25H75V75H62L38 40V75H25Z" 
          fill="white" 
          className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
        />
        {/* Dynamic Checkmark Integrated into the N */}
        <path 
          d="M45 55L55 65L85 30" 
          stroke="#3b82f6" 
          strokeWidth="10" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="drop-shadow-[0_0_8px_rgba(59,130,246,0.9)]"
        />
        {/* White core for the checkmark for that "pro" look */}
        <path 
          d="M45 55L55 65L85 30" 
          stroke="white" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default Logo;
