import React from 'react';

interface DeploymentProgressProps {
  progress: number;
  message: string;
}

export const DeploymentProgress: React.FC<DeploymentProgressProps> = ({ 
  progress, 
  message 
}) => {
  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-gray-400">{message}</span>
        <span className="text-xs text-gray-500">{progress}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};