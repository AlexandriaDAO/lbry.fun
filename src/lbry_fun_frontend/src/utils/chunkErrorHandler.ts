/**
 * Chunk Error Handler with Retry Mechanism
 * Handles webpack chunk loading failures with exponential backoff
 * Uses sessionStorage to persist retry count across reloads
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // Start with 1 second
const RETRY_KEY = 'chunkRetryCount';
const RETRY_TIMESTAMP_KEY = 'chunkRetryTimestamp';

// Type definition for ChunkLoadError
interface ChunkLoadError extends Error {
  name: 'ChunkLoadError';
  request?: string;
}

// Type guard for ChunkLoadError
const isChunkLoadError = (error: any): error is ChunkLoadError => {
  return error?.name === 'ChunkLoadError' ||
         error?.message?.includes('Loading chunk');
};

// Get retry count from sessionStorage
const getRetryCount = (): number => {
  if (typeof window === 'undefined') return 0;

  const count = sessionStorage.getItem(RETRY_KEY);
  const timestamp = sessionStorage.getItem(RETRY_TIMESTAMP_KEY);

  // Reset if more than 5 minutes have passed since last retry
  if (timestamp) {
    const elapsed = Date.now() - parseInt(timestamp, 10);
    if (elapsed > 5 * 60 * 1000) {
      sessionStorage.removeItem(RETRY_KEY);
      sessionStorage.removeItem(RETRY_TIMESTAMP_KEY);
      return 0;
    }
  }

  return count ? parseInt(count, 10) : 0;
};

// Set retry count in sessionStorage
const setRetryCount = (count: number): void => {
  if (typeof window === 'undefined') return;

  sessionStorage.setItem(RETRY_KEY, count.toString());
  sessionStorage.setItem(RETRY_TIMESTAMP_KEY, Date.now().toString());
};

// Clear retry count
const clearRetryCount = (): void => {
  if (typeof window === 'undefined') return;

  sessionStorage.removeItem(RETRY_KEY);
  sessionStorage.removeItem(RETRY_TIMESTAMP_KEY);
};

// Main error handler
export const handleChunkLoadError = (error: Error): void => {
  if (!isChunkLoadError(error)) return;

  const currentRetry = getRetryCount();

  if (currentRetry < MAX_RETRIES) {
    const newCount = currentRetry + 1;
    setRetryCount(newCount);
    const delay = RETRY_DELAY_BASE * Math.pow(2, currentRetry);

    if (process.env.NODE_ENV === 'development') {
      console.warn(`Chunk load failed, retrying (${newCount}/${MAX_RETRIES}) in ${delay}ms...`);
    }

    setTimeout(() => {
      window.location.reload();
    }, delay);
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.error('Max chunk load retries exceeded. Please refresh manually.');
    }

    // Clear retry count for next time
    clearRetryCount();

    // You could show a user-friendly error UI here
    // For now, we'll just let the error bubble up
  }
};

// Install global error handlers
if (typeof window !== 'undefined') {
  // Clear retry count on successful page load
  window.addEventListener('load', () => {
    clearRetryCount();
  });

  // Handle synchronous errors
  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error)) {
      handleChunkLoadError(event.error);
    }
  });

  // Handle promise rejections (for dynamic imports)
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      handleChunkLoadError(event.reason);
      event.preventDefault(); // Prevent console error
    }
  });
}