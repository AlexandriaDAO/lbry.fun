import React from 'react';
import { Badge } from "@/lib/components/ui/badge";
import { LoaderCircle, CheckCircle, XCircle, Clock } from "lucide-react";

export type Status = 'pending' | 'completed' | 'failed' | 'loading';

interface StatusIndicatorProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showText?: boolean;
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  showIcon = true,
  showText = true,
  className = ""
}) => {
  const getStatusConfig = (status: Status) => {
    switch (status) {
      case 'completed':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle,
          text: 'Completed',
          iconColor: 'text-green-600'
        };
      case 'failed':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: XCircle,
          text: 'Failed',
          iconColor: 'text-red-600'
        };
      case 'loading':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: LoaderCircle,
          text: 'Processing',
          iconColor: 'text-blue-600',
          animate: true
        };
      case 'pending':
      default:
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: Clock,
          text: 'Pending',
          iconColor: 'text-yellow-600'
        };
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-xs px-2 py-1';
      case 'lg': return 'text-sm px-3 py-2';
      default: return 'text-sm px-2.5 py-1.5';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm': return 'w-3 h-3';
      case 'lg': return 'w-5 h-5';
      default: return 'w-4 h-4';
    }
  };

  const config = getStatusConfig(status);
  const IconComponent = config.icon;

  return (
    <Badge 
      className={`
        ${config.color} 
        ${getSizeClass()}
        border
        ${className}
      `}
    >
      <div className="flex items-center gap-1.5">
        {showIcon && (
          <IconComponent 
            className={`
              ${getIconSize()} 
              ${config.iconColor}
              ${config.animate ? 'animate-spin' : ''}
            `}
          />
        )}
        {showText && config.text}
      </div>
    </Badge>
  );
};

export default StatusIndicator;