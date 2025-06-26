import { Principal } from '@dfinity/principal';
import { ExecutionError as IcpSwapExecutionError } from '../../../declarations/icp_swap/icp_swap.did';
import { ExecutionError as TokenomicsExecutionError } from '../../../declarations/tokenomics/tokenomics.did';

// Base log structure shared by both canister types
export interface BaseLog {
  log_id: bigint;
  timestamp: bigint;
  caller: Principal;
  function: string;
}

// ICP Swap log types
export interface IcpSwapLog extends BaseLog {
  log_type: IcpSwapLogType;
}

export type IcpSwapLogType = 
  | { Info: { detail: string } }
  | { Error: { error: IcpSwapExecutionError } };

export interface IcpSwapPaginatedLogs {
  logs: IcpSwapLog[];
  current_page: bigint;
  total_pages: bigint;
  page_size: bigint;
}

// Tokenomics log types
export interface TokenomicsLog extends BaseLog {
  log_type: TokenomicsLogType;
}

export type TokenomicsLogType = 
  | { Info: { detail: string } }
  | { Error: { error: TokenomicsExecutionError } };

export interface TokenomicsPaginatedLogs {
  logs: TokenomicsLog[];
  current_page: bigint;
  total_pages: bigint;
  page_size: bigint;
}

// Union types for component usage
export type CanisterLog = IcpSwapLog | TokenomicsLog;
export type CanisterLogType = IcpSwapLogType | TokenomicsLogType;
export type PaginatedLogs = IcpSwapPaginatedLogs | TokenomicsPaginatedLogs;

// Helper type guards
export function isInfoLog(logType: CanisterLogType): logType is { Info: { detail: string } } {
  return 'Info' in logType;
}

export function isErrorLog(logType: CanisterLogType): logType is { Error: { error: IcpSwapExecutionError | TokenomicsExecutionError } } {
  return 'Error' in logType;
}

// Helper to extract log message
export function getLogMessage(logType: CanisterLogType): string {
  if (isInfoLog(logType)) {
    return logType.Info.detail;
  } else if (isErrorLog(logType)) {
    const error = logType.Error.error;
    // Convert error variant to readable string
    const errorKey = Object.keys(error)[0];
    const errorValue = error[errorKey as keyof typeof error];
    
    if (typeof errorValue === 'object' && errorValue !== null) {
      // For complex error types with nested data
      return `${errorKey}: ${JSON.stringify(errorValue)}`;
    } else if (errorValue !== undefined && errorValue !== null) {
      // For errors with simple values
      return `${errorKey}: ${errorValue}`;
    } else {
      // For errors without additional data
      return errorKey;
    }
  }
  return 'Unknown log type';
}

// Helper to format timestamp
export function formatLogTimestamp(timestamp: bigint): string {
  // Convert nanoseconds to milliseconds
  const date = new Date(Number(timestamp / 1_000_000n));
  return date.toLocaleString();
}