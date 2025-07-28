export const callWithRetry = async <T>(
  apiCall: () => Promise<T>, 
  retries = 2
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error: any) {
    if (retries > 0 && (
      error.message?.includes('network') || 
      error.message?.includes('Failed to fetch') ||
      error.code === 'ERR_NETWORK'
    )) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return callWithRetry(apiCall, retries - 1);
    }
    throw error;
  }
};