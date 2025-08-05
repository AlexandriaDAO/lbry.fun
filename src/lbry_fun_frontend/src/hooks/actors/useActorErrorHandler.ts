import { useCallback } from 'react';
import { toast } from 'sonner';
import { isIdentityExpired } from '@/utils/general';

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
    
    // Check if identity has expired using the standard function
    if (isIdentityExpired(error)) {
      toast.error('Session expired.');
      setTimeout(() => {
        if (clearAuth) {
          clearAuth();
        }
        window.location.reload();
      }, 2000);
      return;
    }
    
    // Handle other errors
    if (error instanceof Error) {
      toast.error(error.message);
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