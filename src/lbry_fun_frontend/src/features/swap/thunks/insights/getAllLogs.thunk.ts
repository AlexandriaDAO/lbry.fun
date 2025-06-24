import { createAsyncThunk } from '@reduxjs/toolkit';
import { createLogsActor } from '@/actors/createLogsActor';

const E8S = 100_000_000;

export const getAllLogs = createAsyncThunk(
  'swap/getAllLogs',
  async (canisterId: string, { rejectWithValue }) => {
    // Add retry logic for certificate errors
    let retries = 3;
    let lastError: Error | null = null;
    
    while (retries > 0) {
      try {
        const actor = await createLogsActor(canisterId);
        const response = await actor.get_all_logs();
        
        if (!response) {
          return rejectWithValue('No logs found.');
        }

        const processedData = {
          time: response.map(log => Number(log[1].time) / 1000000), // convert nanoseconds to milliseconds
          primaryTokenSupply: response.map(log => Number(log[1].primary_token_supply) / E8S),
          secondaryTokenSupply: response.map(log => Number(log[1].secondary_token_supply) / E8S),
          totalSecondaryBurned: response.map(log => Number(log[1].total_secondary_burned)), // This is a u64, probably no decimals
          icpInLpTreasury: response.map(log => Number(log[1].icp_in_lp_treasury) / E8S),
          totalPrimaryStaked: response.map(log => Number(log[1].total_primary_staked) / E8S),
          stakerCount: response.map(log => Number(log[1].staker_count)),
          apy: response.map(log => Number(log[1].apy)), 
        };
        
        return processedData;
      } catch (error) {
        lastError = error as Error;
        
        // Check if it's a certificate error and we have retries left
        if (error instanceof Error && 
            error.message.includes("Invalid certificate") && 
            retries > 1) {
          retries--;
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
          continue;
        }
        
        // If not a certificate error or no retries left, break
        break;
      }
    }
    
    // If we get here, all retries failed
    console.error('Failed to get logs after retries:', lastError);
    if (lastError instanceof Error) {
      return rejectWithValue(lastError.message);
    }
    return rejectWithValue('An unknown error occurred while fetching logs.');
  }
);

export default getAllLogs; 