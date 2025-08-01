import { DeploymentRecord, CreateTokenParams } from '@/types/deployment';

const DEPLOYMENT_STORAGE_PREFIX = 'deployment_';
const ACTIVE_DEPLOYMENT_KEY = 'activeDeploymentId';
const HIDDEN_DEPLOYMENTS_KEY = 'hiddenDeploymentIds';
const DEPLOYMENT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PersistedDeployment {
  deployment: DeploymentRecord;
  expires: number;
}

// Save deployment to localStorage
export function persistDeployment(deployment: DeploymentRecord): void {
  const key = `${DEPLOYMENT_STORAGE_PREFIX}${deployment.id}`;
  const data: PersistedDeployment = {
    deployment,
    expires: Date.now() + DEPLOYMENT_EXPIRY_MS
  };
  
  try {
    localStorage.setItem(key, JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  } catch (error) {
    console.error('Failed to persist deployment:', error);
  }
}

// Get deployment from localStorage
export function getPersistedDeployment(deploymentId: string): DeploymentRecord | null {
  const key = `${DEPLOYMENT_STORAGE_PREFIX}${deploymentId}`;
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored, (key, value) => {
      // Convert string numbers back to bigint where needed
      if (key === 'id' || key === 'token_id' || key === 'created_at' || 
          key === 'last_activity' || key === 'failed_at' || key === 'canister_count') {
        return typeof value === 'string' ? BigInt(value) : value;
      }
      return value;
    });
    
    const data = parsed as PersistedDeployment;
    
    // Check if expired
    if (data.expires < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data.deployment;
  } catch (error) {
    console.error('Failed to get persisted deployment:', error);
    return null;
  }
}

// Get all persisted deployments
export function getAllPersistedDeployments(): DeploymentRecord[] {
  const deployments: DeploymentRecord[] = [];
  
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(DEPLOYMENT_STORAGE_PREFIX));
    
    for (const key of keys) {
      const deploymentId = key.replace(DEPLOYMENT_STORAGE_PREFIX, '');
      const deployment = getPersistedDeployment(deploymentId);
      if (deployment) {
        deployments.push(deployment);
      }
    }
  } catch (error) {
    console.error('Failed to get all persisted deployments:', error);
  }
  
  return deployments;
}

// Remove expired deployments
export function cleanupExpiredDeployments(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(DEPLOYMENT_STORAGE_PREFIX));
    
    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      
      try {
        const data = JSON.parse(stored) as PersistedDeployment;
        if (data.expires < Date.now()) {
          localStorage.removeItem(key);
        }
      } catch {
        // Remove corrupted data
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup expired deployments:', error);
  }
}

// Get and set active deployment
export function getActiveDeploymentId(): string | null {
  return localStorage.getItem(ACTIVE_DEPLOYMENT_KEY);
}

export function setActiveDeploymentId(deploymentId: string | null): void {
  if (deploymentId) {
    localStorage.setItem(ACTIVE_DEPLOYMENT_KEY, deploymentId);
  } else {
    localStorage.removeItem(ACTIVE_DEPLOYMENT_KEY);
  }
}

// Clear specific deployment
export function clearPersistedDeployment(deploymentId: string): void {
  const key = `${DEPLOYMENT_STORAGE_PREFIX}${deploymentId}`;
  localStorage.removeItem(key);
}

// Clear all deployment data
export function clearAllDeploymentData(): void {
  const keys = Object.keys(localStorage).filter(k => 
    k.startsWith(DEPLOYMENT_STORAGE_PREFIX) || k === ACTIVE_DEPLOYMENT_KEY
  );
  
  keys.forEach(key => localStorage.removeItem(key));
}