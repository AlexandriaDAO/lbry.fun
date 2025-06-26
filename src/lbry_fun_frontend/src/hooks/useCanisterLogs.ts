import { useState, useEffect, useCallback } from 'react';
import { createCanisterActor, CanisterType } from '../actors/canisterActorFactory';
import { 
  IcpSwapPaginatedLogs, 
  TokenomicsPaginatedLogs, 
  PaginatedLogs,
  formatLogTimestamp,
  getLogMessage,
  isInfoLog,
  isErrorLog
} from '../types/logs';

interface UseCanisterLogsOptions {
  pageSize?: number;
  autoRefreshInterval?: number; // in milliseconds, 0 to disable
}

interface UseCanisterLogsResult {
  logs: PaginatedLogs | null;
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  fetchLogs: (page?: number) => Promise<void>;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  refresh: () => void;
}

export const useCanisterLogs = (
  canisterId: string,
  canisterType: CanisterType,
  options: UseCanisterLogsOptions = {}
): UseCanisterLogsResult => {
  const { pageSize = 20, autoRefreshInterval = 0 } = options;
  
  const [logs, setLogs] = useState<PaginatedLogs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchLogs = useCallback(async (page: number = 1) => {
    if (!canisterId) {
      setError('No canister ID provided');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const actor = await createCanisterActor(canisterId, canisterType);
      
      let paginatedLogs: PaginatedLogs;
      
      if (canisterType === 'icp_swap') {
        // ICP Swap uses get_logs method
        const result = await (actor as any).get_logs(
          BigInt(page), 
          BigInt(pageSize)
        ) as IcpSwapPaginatedLogs;
        paginatedLogs = result;
      } else {
        // Tokenomics uses get_token_logs method
        const result = await (actor as any).get_token_logs(
          BigInt(page), 
          BigInt(pageSize)
        ) as TokenomicsPaginatedLogs;
        paginatedLogs = result;
      }

      setLogs(paginatedLogs);
      setCurrentPage(Number(paginatedLogs.current_page));
      setTotalPages(Number(paginatedLogs.total_pages));
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [canisterId, canisterType, pageSize]);

  // Initial fetch
  useEffect(() => {
    fetchLogs(currentPage);
  }, [canisterId, canisterType]); // Only re-fetch if canister changes

  // Auto refresh interval
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(() => {
        fetchLogs(currentPage);
      }, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval, currentPage, fetchLogs]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchLogs(newPage);
    }
  }, [currentPage, totalPages, fetchLogs]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchLogs(newPage);
    }
  }, [currentPage, fetchLogs]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      fetchLogs(page);
    }
  }, [totalPages, fetchLogs]);

  const refresh = useCallback(() => {
    fetchLogs(currentPage);
  }, [currentPage, fetchLogs]);

  return {
    logs,
    loading,
    error,
    currentPage,
    totalPages,
    fetchLogs,
    nextPage,
    prevPage,
    goToPage,
    refresh
  };
};

// Helper hook to process logs for display
export const useProcessedLogs = (logs: PaginatedLogs | null) => {
  return logs?.logs.map(log => ({
    id: log.log_id.toString(),
    timestamp: formatLogTimestamp(log.timestamp),
    function: log.function,
    caller: log.caller.toText(),
    isInfo: isInfoLog(log.log_type),
    isError: isErrorLog(log.log_type),
    message: getLogMessage(log.log_type),
    logType: log.log_type
  })) || [];
};