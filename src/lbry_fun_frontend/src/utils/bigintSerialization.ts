import {
  DistributionSummary,
  DistributionEvent,
  DistributionAllocations,
  DistributionResults,
  LifetimeDistributionTotals,
  LpProvisionStatus,
} from '../features/swap/types/distributionTypes';

// Serialized versions of types (with BigInt converted to string)
export interface SerializedDistributionAllocations {
  alexandria_allocated: string;
  lp_treasury_allocated: string;
  stakers_allocated: string;
}

export interface SerializedLpProvisionStatus {
  Pending?: null;
  Success?: { lp_tokens: string };
  Failed?: { reason: string };
}

export interface SerializedDistributionResults {
  alexandria_sent: string[] | null;
  lp_treasury_added: string;
  stakers_distributed: string[] | null;
  stakers_rollover: string;
  lp_provision_status: SerializedLpProvisionStatus;
  error_details: string[] | null;
}

export interface SerializedLifetimeDistributionTotals {
  total_distributed: string;
  alexandria_total: string;
  lp_treasury_total: string;
  stakers_total: string;
}

export interface SerializedDistributionEvent {
  event_id: string;
  timestamp: string;
  distribution_cycle: number;
  total_available: string;
  allocations: SerializedDistributionAllocations;
  results: SerializedDistributionResults;
}

export interface SerializedDistributionSummary {
  total_cycles: number;
  total_alexandria_sent: string;
  total_lp_treasury_balance: string;
  total_stakers_distributed: string;
  current_lp_provision_queue: string;
  last_distribution: SerializedDistributionEvent | null;
  lifetime_totals: SerializedLifetimeDistributionTotals;
}

// Conversion functions
export function serializeDistributionAllocations(allocations: DistributionAllocations): SerializedDistributionAllocations {
  return {
    alexandria_allocated: allocations.alexandria_allocated.toString(),
    lp_treasury_allocated: allocations.lp_treasury_allocated.toString(),
    stakers_allocated: allocations.stakers_allocated.toString(),
  };
}

export function serializeLpProvisionStatus(status: LpProvisionStatus): SerializedLpProvisionStatus {
  if ('Pending' in status) {
    return { Pending: null };
  } else if ('Success' in status) {
    return { Success: { lp_tokens: status.Success.lp_tokens.toString() } };
  } else if ('Failed' in status) {
    return { Failed: { reason: status.Failed.reason } };
  }
  return {};
}

export function serializeDistributionResults(results: DistributionResults): SerializedDistributionResults {
  return {
    alexandria_sent: results.alexandria_sent ? results.alexandria_sent.map(v => v.toString()) : null,
    lp_treasury_added: results.lp_treasury_added.toString(),
    stakers_distributed: results.stakers_distributed ? results.stakers_distributed.map(v => v.toString()) : null,
    stakers_rollover: results.stakers_rollover.toString(),
    lp_provision_status: serializeLpProvisionStatus(results.lp_provision_status),
    error_details: results.error_details,
  };
}

export function serializeLifetimeDistributionTotals(totals: LifetimeDistributionTotals): SerializedLifetimeDistributionTotals {
  return {
    total_distributed: totals.total_distributed.toString(),
    alexandria_total: totals.alexandria_total.toString(),
    lp_treasury_total: totals.lp_treasury_total.toString(),
    stakers_total: totals.stakers_total.toString(),
  };
}

export function serializeDistributionEvent(event: DistributionEvent): SerializedDistributionEvent {
  return {
    event_id: event.event_id.toString(),
    timestamp: event.timestamp.toString(),
    distribution_cycle: event.distribution_cycle,
    total_available: event.total_available.toString(),
    allocations: serializeDistributionAllocations(event.allocations),
    results: serializeDistributionResults(event.results),
  };
}

export function serializeDistributionSummary(summary: DistributionSummary): SerializedDistributionSummary {
  return {
    total_cycles: summary.total_cycles,
    total_alexandria_sent: summary.total_alexandria_sent.toString(),
    total_lp_treasury_balance: summary.total_lp_treasury_balance.toString(),
    total_stakers_distributed: summary.total_stakers_distributed.toString(),
    current_lp_provision_queue: summary.current_lp_provision_queue.toString(),
    last_distribution: summary.last_distribution ? serializeDistributionEvent(summary.last_distribution) : null,
    lifetime_totals: serializeLifetimeDistributionTotals(summary.lifetime_totals),
  };
}

export function serializeDistributionEvents(events: DistributionEvent[]): SerializedDistributionEvent[] {
  return events.map(serializeDistributionEvent);
}

// Deserialization functions (for when you need BigInt back)
export function deserializeDistributionAllocations(allocations: SerializedDistributionAllocations): DistributionAllocations {
  return {
    alexandria_allocated: BigInt(allocations.alexandria_allocated),
    lp_treasury_allocated: BigInt(allocations.lp_treasury_allocated),
    stakers_allocated: BigInt(allocations.stakers_allocated),
  };
}

export function deserializeLpProvisionStatus(status: SerializedLpProvisionStatus): LpProvisionStatus {
  if (status.Pending !== undefined) {
    return { Pending: null };
  } else if (status.Success !== undefined) {
    return { Success: { lp_tokens: BigInt(status.Success.lp_tokens) } };
  } else if (status.Failed !== undefined) {
    return { Failed: { reason: status.Failed.reason } };
  }
  return { Pending: null }; // Default case
}

export function deserializeDistributionResults(results: SerializedDistributionResults): DistributionResults {
  return {
    alexandria_sent: results.alexandria_sent ? results.alexandria_sent.map(v => BigInt(v)) : null,
    lp_treasury_added: BigInt(results.lp_treasury_added),
    stakers_distributed: results.stakers_distributed ? results.stakers_distributed.map(v => BigInt(v)) : null,
    stakers_rollover: BigInt(results.stakers_rollover),
    lp_provision_status: deserializeLpProvisionStatus(results.lp_provision_status),
    error_details: results.error_details,
  };
}

export function deserializeLifetimeDistributionTotals(totals: SerializedLifetimeDistributionTotals): LifetimeDistributionTotals {
  return {
    total_distributed: BigInt(totals.total_distributed),
    alexandria_total: BigInt(totals.alexandria_total),
    lp_treasury_total: BigInt(totals.lp_treasury_total),
    stakers_total: BigInt(totals.stakers_total),
  };
}

export function deserializeDistributionEvent(event: SerializedDistributionEvent): DistributionEvent {
  return {
    event_id: BigInt(event.event_id),
    timestamp: BigInt(event.timestamp),
    distribution_cycle: event.distribution_cycle,
    total_available: BigInt(event.total_available),
    allocations: deserializeDistributionAllocations(event.allocations),
    results: deserializeDistributionResults(event.results),
  };
}

export function deserializeDistributionSummary(summary: SerializedDistributionSummary): DistributionSummary {
  return {
    total_cycles: summary.total_cycles,
    total_alexandria_sent: BigInt(summary.total_alexandria_sent),
    total_lp_treasury_balance: BigInt(summary.total_lp_treasury_balance),
    total_stakers_distributed: BigInt(summary.total_stakers_distributed),
    current_lp_provision_queue: BigInt(summary.current_lp_provision_queue),
    last_distribution: summary.last_distribution ? deserializeDistributionEvent(summary.last_distribution) : null,
    lifetime_totals: deserializeLifetimeDistributionTotals(summary.lifetime_totals),
  };
}