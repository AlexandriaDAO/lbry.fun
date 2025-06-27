import { createAsyncThunk } from "@reduxjs/toolkit";
import { getActorSwap } from "@/features/auth/utils/authUtils";
import type { 
  DistributionSummary, 
  DistributionEvent, 
  DistributionEventsParams 
} from "../types/distributionTypes";
import {
  serializeDistributionSummary,
  serializeDistributionEvents,
  serializeDistributionEvent,
} from "@/utils/bigintSerialization";

// Fetch distribution summary
export const fetchDistributionSummary = createAsyncThunk(
  'swap/fetchDistributionSummary',
  async (icpSwapId: string, { rejectWithValue }) => {
    try {
      const actor = await getActorSwap(icpSwapId);
      const summary = await actor.get_distribution_summary();
      return serializeDistributionSummary(summary as DistributionSummary);
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch distribution summary');
    }
  }
);

// Fetch distribution events with pagination
export const fetchDistributionEvents = createAsyncThunk(
  'swap/fetchDistributionEvents',
  async ({ icpSwapId, fromId = 0, limit = 10 }: DistributionEventsParams, { rejectWithValue }) => {
    try {
      const actor = await getActorSwap(icpSwapId);
      const events = await actor.get_distribution_events(BigInt(fromId), limit);
      return serializeDistributionEvents(events as DistributionEvent[]);
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch distribution events');
    }
  }
);

// Fetch latest distribution event
export const fetchLatestDistributionEvent = createAsyncThunk(
  'swap/fetchLatestDistributionEvent',
  async (icpSwapId: string, { rejectWithValue }) => {
    try {
      const actor = await getActorSwap(icpSwapId);
      const event = await actor.get_latest_distribution_event();
      return event ? serializeDistributionEvent(event as DistributionEvent) : null;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch latest distribution event');
    }
  }
);

// Export all thunks
export const distributionThunks = {
  fetchDistributionSummary,
  fetchDistributionEvents,
  fetchLatestDistributionEvent,
};