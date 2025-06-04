import React, { useState } from 'react';

interface TooltipIconProps {
  text: string;
}

const TooltipIcon: React.FC<TooltipIconProps> = ({ text }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div 
      className="relative inline-block ml-2 cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth={1.5} 
        stroke="currentColor" 
        className="w-5 h-5 text-gray-500 hover:text-blue-500"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" 
        />
      </svg>
      {showTooltip && (
        <div 
          className="absolute z-10 w-64 p-3 text-sm text-white bg-gray-700 rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2"
          style={{ minWidth: '250px'}} // Ensure tooltip has enough width
        >
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-gray-700"></div>
        </div>
      )}
    </div>
  );
};

export default TooltipIcon; 