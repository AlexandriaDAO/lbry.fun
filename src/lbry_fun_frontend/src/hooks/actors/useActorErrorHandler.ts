import { useCallback } from 'react';
import { toast } from 'sonner';

export const useActorErrorHandler = (clearAuth?: () => void) => {
  const errorToast = useCallback((error: Error | unknown) => {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    toast.error(message);
  }, []);

  const handleRequest = useCallback((data: { methodName: string }) => {
    // Could add request logging here if needed
    console.debug('Actor request:', data.methodName);
  }, []);

  const handleResponse = useCallback((data: { methodName: string }) => {
    // Could add response logging here if needed
    console.debug('Actor response:', data.methodName);
  }, []);

  const handleResponseError = useCallback((error: Error | unknown) => {
    console.error('Actor response error:', error);
    
    // Handle specific error cases
    if (error instanceof Error) {
      // Check for various authentication/signature errors
      if (error.message.includes('Invalid certificate') || 
          error.message.includes('delegation') ||
          error.message.includes('authentication') ||
          error.message.includes('Invalid signature') ||
          error.message.includes('signature could not be verified') ||
          error.message.includes('verification failed')) {
        // Authentication error - clear auth state
        if (clearAuth) {
          clearAuth();
        }
        toast.error('[ERROR] AUTHENTICATION EXPIRED → PLEASE LOG IN AGAIN');
        // Force reload to clear all cached state
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.error(error.message);
      }
    } else {
      toast.error('[ERROR] UNEXPECTED ERROR OCCURRED');
    }
  }, [clearAuth]);

  return {
    errorToast,
    handleRequest,
    handleResponse,
    handleResponseError
  };
};