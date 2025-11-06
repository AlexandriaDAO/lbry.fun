/**
 * Chunk Error Handler with Retry Mechanism
 * Handles webpack chunk loading failures with exponential backoff
 */

import React from 'react';

let retryCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // Start with 1 second

export const handleChunkLoadError = (error: Error): void => {
  if (error.name === 'ChunkLoadError' && retryCount < MAX_RETRIES) {
    retryCount++;
    const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount - 1);

    console.warn(`Chunk load failed, retrying (${retryCount}/${MAX_RETRIES}) in ${delay}ms...`);

    setTimeout(() => {
      window.location.reload();
    }, delay);
  } else if (retryCount >= MAX_RETRIES) {
    console.error('Max chunk load retries exceeded. Please refresh manually.');
  }
};

// Install global error handler for chunk load errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.error && event.error.name === 'ChunkLoadError') {
      handleChunkLoadError(event.error);
    }
  });

  // Handle promise rejections (for dynamic imports)
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.name === 'ChunkLoadError') {
      handleChunkLoadError(event.reason);
      event.preventDefault(); // Prevent console error
    }
  });
}

// Export a wrapper for lazy loading with retry
export const lazyWithRetry = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> => {
  return React.lazy(async () => {
    try {
      return await importFunc();
    } catch (error: any) {
      if (error.name === 'ChunkLoadError' && retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount - 1);

        await new Promise(resolve => setTimeout(resolve, delay));

        // Try to reload the chunk
        return importFunc();
      }
      throw error;
    }
  });
};

// Reset retry count on successful load
export const resetRetryCount = () => {
  retryCount = 0;
};