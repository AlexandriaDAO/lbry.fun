import { useState, useCallback, useEffect, useRef } from 'react';

interface RefreshOptions {
  autoRefresh?: number;
  dedupTime?: number; // Prevent duplicate calls within X ms
}

export function useRefreshableData<T>(
  key: string,
  fetcher: () => Promise<T>,
  deps: any[] = [],
  options?: RefreshOptions
) {
  const [data, setData] = useState<T>(); // KEEP THIS - we need data!
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchTime = useRef(0);
  const abortController = useRef<AbortController>();
  const fetchPromise = useRef<Promise<T> | null>(null);
  const depsRef = useRef(deps);
  
  // Update deps ref when deps change
  useEffect(() => {
    depsRef.current = deps;
  }, deps);

  const refresh = useCallback(async () => {
    // Deduplication - return active promise if exists
    const now = Date.now();
    if (now - lastFetchTime.current < (options?.dedupTime || 1000)) {
      if (fetchPromise.current) {
        return fetchPromise.current; // Return the active promise
      }
      return data; // Return existing data if no active promise
    }

    // Cancel any previous request
    abortController.current?.abort();
    abortController.current = new AbortController();

    setIsRefreshing(true);
    setError(null);
    lastFetchTime.current = now;

    // Create and store the promise
    fetchPromise.current = (async () => {
      try {
        const result = await fetcher();
        // Only update state if not aborted
        if (!abortController.current?.signal.aborted) {
          setData(result); // SAVE THE DATA!
          fetchPromise.current = null; // Clear the promise
          return result;
        }
        // Request was aborted - this is normal, don't throw
        return data; // Return existing data when aborted
      } catch (err) {
        fetchPromise.current = null; // Clear the promise on error
        if (!abortController.current?.signal.aborted) {
          setError(err as Error);
          throw err;
        }
        // Request was aborted during error - this is normal, don't throw
        return data; // Return existing data when aborted
      } finally {
        if (!abortController.current?.signal.aborted) {
          setIsRefreshing(false);
        }
      }
    })();

    return fetchPromise.current;
  }, [fetcher, options?.dedupTime]); // Only stable dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => abortController.current?.abort();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (options?.autoRefresh) {
      const interval = setInterval(refresh, options.autoRefresh);
      return () => clearInterval(interval);
    }
  }, [refresh, options?.autoRefresh]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, deps); // Just deps, triggers when dependencies change

  return { data, refresh, isRefreshing, error }; // RETURN DATA!
}