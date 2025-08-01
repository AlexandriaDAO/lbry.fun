import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DeploymentRecord, getUIState } from '@/types/deployment';
import { RootState } from '@/store';

interface DeploymentState {
  deployments: Record<string, DeploymentRecord>;
  activeDeploymentId: string | null;
  isLoading: boolean;
}

const initialState: DeploymentState = {
  deployments: {},
  activeDeploymentId: null,
  isLoading: false
};

// Simple actions - no complex state management
export const deploymentSlice = createSlice({
  name: 'deployment',
  initialState,
  reducers: {
    // Just store/update deployments
    setDeployments: (state, action: PayloadAction<DeploymentRecord[]>) => {
      state.deployments = {};
      action.payload.forEach(d => {
        state.deployments[d.id.toString()] = d;
      });
    },
    
    updateDeployment: (state, action: PayloadAction<DeploymentRecord>) => {
      state.deployments[action.payload.id.toString()] = action.payload;
    },
    
    removeDeployment: (state, action: PayloadAction<string>) => {
      delete state.deployments[action.payload];
    },
    
    setActiveDeploymentId: (state, action: PayloadAction<string | null>) => {
      state.activeDeploymentId = action.payload;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    }
  }
});

export const {
  setDeployments,
  updateDeployment,
  removeDeployment,
  setActiveDeploymentId,
  setLoading
} = deploymentSlice.actions;

// No complex state derivation - just selectors
export const selectDeploymentUIState = (deploymentId: string) => (state: RootState) => {
  const deployment = state.deployment.deployments[deploymentId];
  return deployment ? getUIState(deployment.tokenStatus) : null;
};

export const selectActiveDeployments = (state: RootState) => {
  return Object.values(state.deployment.deployments).filter(d => 
    'Deploying' in d.tokenStatus
  );
};

export const selectDeploymentById = (id: string) => (state: RootState) => {
  return state.deployment.deployments[id];
};

export const selectAllDeployments = (state: RootState) => {
  return Object.values(state.deployment.deployments);
};

export default deploymentSlice.reducer;