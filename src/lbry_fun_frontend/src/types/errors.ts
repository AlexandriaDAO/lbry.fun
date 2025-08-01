export interface DeploymentError {
  title: string;
  message: string;
  deploymentId?: string;
  canRetry?: boolean;
  refundAvailable?: boolean;
  isTimeout?: boolean;
}

export const parseDeploymentError = (error: string): DeploymentError => {
  if (error.includes('timeout') || error.includes('still processing')) {
    return {
      title: 'Deployment In Progress',
      message: 'The deployment is taking longer than expected. We\'re monitoring its progress.',
      canRetry: false,
      isTimeout: true
    };
  }
  
  if (error.includes('You have an active deployment')) {
    // Extract deployment ID from error message
    const match = error.match(/ID: (\d+)/);
    const deploymentId = match ? match[1] : undefined;
    
    return {
      title: 'Active Deployment Exists',
      message: `You have an unfinished deployment${deploymentId ? ` (ID: ${deploymentId})` : ''}. Please complete or cancel it before creating a new one.`,
      deploymentId,
      canRetry: false,
      refundAvailable: true
    };
  }
  
  if (error.includes('insufficient funds')) {
    return {
      title: 'Insufficient Funds',
      message: 'Please ensure you have enough ICP to complete the deployment.',
      canRetry: false
    };
  }
  
  if (error.includes('canister creation failed')) {
    return {
      title: 'Canister Creation Failed',
      message: 'Failed to create one or more canisters. Your payment will be refunded.',
      refundAvailable: true,
      canRetry: true
    };
  }
  
  return {
    title: 'Deployment Failed',
    message: error,
    canRetry: true
  };
};