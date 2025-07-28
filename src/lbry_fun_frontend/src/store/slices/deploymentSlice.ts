import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DeploymentRecord, DeploymentStatus } from '@/types/deployment';

interface DeploymentState {
  deployments: Record<string, DeploymentRecord>;
  activeDeploymentId: string | null;
  status: 'idle' | 'initiating' | 'executing' | 'polling' | 'recovering' | 'completed' | 'failed';
  error: { title: string; message: string } | null;
  pollingInterval: NodeJS.Timeout | null;
  pollAttempts: number;
  maxPollAttempts: 60;
}

const initialState: DeploymentState = {
  deployments: {},
  activeDeploymentId: null,
  status: 'idle',
  error: null,
  pollingInterval: null,
  pollAttempts: 0,
  maxPollAttempts: 60
};

const deploymentSlice = createSlice({
  name: 'deployment',
  initialState,
  reducers: {
    setActiveDeployment: (state, action: PayloadAction<string>) => {
      state.activeDeploymentId = action.payload;
      state.error = null;
    },
    
    updateDeployment: (state, action: PayloadAction<DeploymentRecord>) => {
      const id = action.payload.id.toString();
      state.deployments[id] = action.payload;
    },
    
    setDeploymentStatus: (state, action: PayloadAction<{
      id: string;
      status: DeploymentStatus;
      error?: string;
    }>) => {
      const { id, status, error } = action.payload;
      if (state.deployments[id]) {
        state.deployments[id].frontendStatus = status;
        state.deployments[id].lastChecked = Date.now();
        
        if (error) {
          state.deployments[id].last_error = [error];
        }
        
        if (status === DeploymentStatus.FAILED) {
          const deployment = state.deployments[id];
          const timeSinceActivity = Date.now() - Number(deployment.last_activity / 1_000_000n);
          deployment.recoverable = timeSinceActivity > 5 * 60 * 1000;
        }
      }
    },
    
    clearActiveDeployment: (state) => {
      state.activeDeploymentId = null;
      state.status = 'idle';
      state.error = null;
      state.pollAttempts = 0;
      
      if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
      }
      
      localStorage.removeItem('activeDeploymentId');
    },
    
    setPollingInterval: (state, action: PayloadAction<NodeJS.Timeout | null>) => {
      if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
      }
      state.pollingInterval = action.payload;
    },
    
    incrementPollAttempts: (state) => {
      state.pollAttempts += 1;
    },
    
    setError: (state, action: PayloadAction<{ title: string; message: string } | null>) => {
      state.error = action.payload;
    }
  }
});

export const {
  setActiveDeployment,
  updateDeployment,
  setDeploymentStatus,
  clearActiveDeployment,
  setPollingInterval,
  incrementPollAttempts,
  setError
} = deploymentSlice.actions;

export default deploymentSlice.reducer;