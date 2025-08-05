import { Middleware } from '@reduxjs/toolkit';
import { resetOperation } from '../store/swapSlice';
import { OperationStates } from '../store/swapTypes';

const OPERATION_MAP: Record<string, keyof OperationStates> = {
  'swap/swapSecondary': 'swap',
  'swap/burnSecondary': 'burn',
  'swap/stakePrimary': 'stake',
  'swap/unstake': 'unstake',
  'swap/claimReward': 'claim',
  'swap/transferPrimary': 'transferPrimary',
  'swap/transferSecondary': 'transferSecondary',
  'icp_ledger/transferICP': 'transferIcp',
  'swap/redeemArchivedBalance': 'redeem',
};

export const operationMiddleware: Middleware = store => next => action => {
  const result = next(action);
  
  // Auto-reset successful operations after 3 seconds
  if (action.type.endsWith('/fulfilled')) {
    const operationKey = Object.keys(OPERATION_MAP).find(key => 
      action.type.startsWith(key)
    );
    
    if (operationKey) {
      const operation = OPERATION_MAP[operationKey];
      setTimeout(() => {
        store.dispatch(resetOperation(operation));
      }, 3000);
    }
  }
  
  return result;
};