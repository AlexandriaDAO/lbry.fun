export interface DistributionAllocations {
  alexandria_allocated: bigint;
  lp_treasury_allocated: bigint;
  stakers_allocated: bigint;
}

export interface DistributionResults {
  alexandria_sent: bigint[] | null;
  lp_treasury_added: bigint;
  stakers_distributed: bigint[] | null;
  stakers_rollover: bigint;
  lp_provision_status: LpProvisionStatus;
  error_details: string[] | null;
}

export type LpProvisionStatus = 
  | { Pending: null }
  | { Success: { lp_tokens: bigint } }
  | { Failed: { reason: string } };

export interface DistributionEvent {
  event_id: bigint;
  timestamp: bigint;
  distribution_cycle: number;
  total_available: bigint;
  allocations: DistributionAllocations;
  results: DistributionResults;
}

export interface LifetimeDistributionTotals {
  total_distributed: bigint;
  alexandria_total: bigint;
  lp_treasury_total: bigint;
  stakers_total: bigint;
}

export interface DistributionSummary {
  total_cycles: number;
  total_alexandria_sent: bigint;
  total_lp_treasury_balance: bigint;
  total_stakers_distributed: bigint;
  current_lp_provision_queue: bigint;
  last_distribution: DistributionEvent | null;
  lifetime_totals: LifetimeDistributionTotals;
}

export interface DistributionEventsParams {
  icpSwapId: string;
  fromId?: number;
  limit?: number;
}