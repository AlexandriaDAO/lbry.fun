export interface TransactionData {
  id: string;
  timestamp: Date;
  kind: 'transfer' | 'mint' | 'burn' | 'approve';
  amount: string; // Natural format for display
  from?: string;
  to?: string;
  fee?: string;
  token: 'primary' | 'secondary';
  status: 'completed' | 'pending' | 'failed';
}

export interface TransactionHistoryState {
  transactions: TransactionData[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  hasMore: boolean;
  currentPage: number;
}

export interface FetchTransactionsParams {
  userPrincipal: string;
  pageSize?: number;
  startIndex?: number;
}