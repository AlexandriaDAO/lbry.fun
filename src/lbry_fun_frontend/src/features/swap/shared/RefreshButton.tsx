import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/lib/components/button";
import { toast } from "sonner";

interface RefreshButtonProps {
  onRefresh: () => void;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  showText?: boolean;
  toastMessage?: string;
  className?: string;
}

const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  loading = false,
  size = 'md',
  variant = 'ghost',
  showText = false,
  toastMessage = "Refreshing...",
  className = ""
}) => {
  const handleClick = () => {
    onRefresh();
    if (toastMessage) {
      toast.info(toastMessage);
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'h-8 w-8';
      case 'lg': return 'h-12 w-12';
      default: return 'h-10 w-10';
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={variant}
      size={showText ? size : 'icon'}
      className={`${!showText ? getSizeClass() : ''} ${className}`}
    >
      <FontAwesomeIcon
        icon={faRotate}
        className={`${showText ? 'mr-2' : ''} ${loading ? 'animate-spin' : ''}`}
      />
      {showText && (loading ? 'Refreshing...' : 'Refresh')}
    </Button>
  );
};

export default RefreshButton;