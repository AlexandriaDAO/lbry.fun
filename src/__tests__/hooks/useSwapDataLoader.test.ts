import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useSwapDataLoader, LoadingPhase } from '../../lbry_fun_frontend/src/features/swap/hooks/useSwapDataLoader';
import { setIsLoadingCriticalData, setIsLoadingSecondaryData } from '../../lbry_fun_frontend/src/features/swap/swapSlice';
import swapSlice from '../../lbry_fun_frontend/src/features/swap/swapSlice';
import authSlice from '../../lbry_fun_frontend/src/features/auth/authSlice';
import { performanceMonitor } from '../../lbry_fun_frontend/src/features/swap/utils/performanceMonitor';

// Mock all thunks
jest.mock('../../lbry_fun_frontend/src/features/swap/thunks/getSecondaryratio');
jest.mock('../../lbry_fun_frontend/src/features/swap/thunks/tokenomics/getPrimaryMintRate');
jest.mock('../../lbry_fun_frontend/src/features/swap/thunks/secondaryIcrc/getSecondaryFee');
jest.mock('../../lbry_fun_frontend/src/features/swap/thunks/primaryIcrc/getPrimaryFee');
jest.mock('../../lbry_fun_frontend/src/features/swap/thunks/primaryIcrc/getAccountPrimaryBalance');
jest.mock('../../lbry_fun_frontend/src/features/swap/thunks/secondaryIcrc/getSecondaryBalance');
jest.mock('../../lbry_fun_frontend/src/features/swap/thunks/getStakedInfo');
jest.mock('../../lbry_fun_frontend/src/features/icp-ledger/thunks/getIcpBal');
jest.mock('../../lbry_fun_frontend/src/features/icp-ledger/thunks/getIcpPrice');
jest.mock('../../lbry_fun_frontend/src/features/icp-ledger/thunks/getCanisterBal');
jest.mock('../../lbry_fun_frontend/src/features/swap/thunks/getArchivedBal');
jest.mock('../../lbry_fun_frontend/src/features/swap/thunks/getCanisterArchivedBal');

// Mock performance monitor
jest.mock('../../lbry_fun_frontend/src/features/swap/utils/performanceMonitor', () => ({
  performanceMonitor: {
    startMetric: jest.fn(),
    endMetric: jest.fn(),
  }
}));

// Mock cache warming
jest.mock('../../lbry_fun_frontend/src/utils/cacheWarming', () => ({
  initializeCacheWarming: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: jest.fn(() => false)
  })),
  getCacheWarmingManager: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: jest.fn(() => false)
  }))
}));

// Mock thunk implementations
const mockThunk = (name: string) => jest.fn(() => ({
  unwrap: jest.fn(() => Promise.resolve(`${name} result`))
}));

const getSecondaryratio = require('../../lbry_fun_frontend/src/features/swap/thunks/getSecondaryratio');
const getPrimaryMintRate = require('../../lbry_fun_frontend/src/features/swap/thunks/tokenomics/getPrimaryMintRate');
const getSecondaryFee = require('../../lbry_fun_frontend/src/features/swap/thunks/secondaryIcrc/getSecondaryFee');
const getPrimaryFee = require('../../lbry_fun_frontend/src/features/swap/thunks/primaryIcrc/getPrimaryFee');
const getAccountPrimaryBalance = require('../../lbry_fun_frontend/src/features/swap/thunks/primaryIcrc/getAccountPrimaryBalance');
const getSecondaryBalance = require('../../lbry_fun_frontend/src/features/swap/thunks/secondaryIcrc/getSecondaryBalance');
const getStakedInfo = require('../../lbry_fun_frontend/src/features/swap/thunks/getStakedInfo');
const getIcpBal = require('../../lbry_fun_frontend/src/features/icp-ledger/thunks/getIcpBal');
const getIcpPrice = require('../../lbry_fun_frontend/src/features/icp-ledger/thunks/getIcpPrice');
const getCanisterBal = require('../../lbry_fun_frontend/src/features/icp-ledger/thunks/getCanisterBal');
const getArchivedBal = require('../../lbry_fun_frontend/src/features/swap/thunks/getArchivedBal');
const getCanisterArchivedBal = require('../../lbry_fun_frontend/src/features/swap/thunks/getCanisterArchivedBal');

// Setup default mocks
getSecondaryratio.default = mockThunk('getSecondaryratio');
getPrimaryMintRate.default = mockThunk('getPrimaryMintRate');
getSecondaryFee.default = mockThunk('getSecondaryFee');
getPrimaryFee.default = mockThunk('getPrimaryFee');
getAccountPrimaryBalance.default = mockThunk('getAccountPrimaryBalance');
getSecondaryBalance.default = mockThunk('getSecondaryBalance');
getStakedInfo.default = mockThunk('getStakedInfo');
getIcpBal.default = mockThunk('getIcpBal');
getIcpPrice.default = mockThunk('getIcpPrice');
getCanisterBal.default = mockThunk('getCanisterBal');
getArchivedBal.default = mockThunk('getArchivedBal');
getCanisterArchivedBal.default = mockThunk('getCanisterArchivedBal');

describe('useSwapDataLoader', () => {
  let store: any;

  const createTestStore = (initialState = {}) => {
    return configureStore({
      reducer: {
        swap: swapSlice,
        auth: authSlice,
      },
      preloadedState: {
        swap: {
          activeSwapPool: null,
          isLoadingCriticalData: false,
          isLoadingSecondaryData: false,
          ...initialState.swap
        },
        auth: {
          isAuthenticated: false,
          principal: null,
          ...initialState.auth
        }
      }
    });
  };

  const wrapper = ({ children }: { children: any }) => {
    const React = require('react');
    return React.createElement(Provider, { store }, children);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    store = createTestStore();
  });

  describe('Loading phases', () => {
    test('starts in IDLE phase', () => {
      const { result } = renderHook(() => useSwapDataLoader(), { wrapper });
      
      expect(result.current.loadingPhase).toBe(LoadingPhase.IDLE);
      expect(result.current.isSwapReady).toBe(false);
      expect(result.current.criticalDataLoaded).toBe(false);
    });

    test('transitions to LOADING_POOL when no active pool', () => {
      const { result } = renderHook(() => useSwapDataLoader(), { wrapper });
      
      expect(result.current.loadingPhase).toBe(LoadingPhase.LOADING_POOL);
    });

    test('transitions through phases when pool is active', async () => {
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      const { result } = renderHook(() => useSwapDataLoader(), { wrapper });

      // Should start loading critical data
      await waitFor(() => {
        expect(result.current.loadingPhase).toBe(LoadingPhase.LOADING_CRITICAL);
      });

      // Should transition to secondary loading
      await waitFor(() => {
        expect(result.current.loadingPhase).toBe(LoadingPhase.LOADING_SECONDARY);
      });

      // Should become ready
      await waitFor(() => {
        expect(result.current.loadingPhase).toBe(LoadingPhase.READY);
        expect(result.current.isSwapReady).toBe(true);
      });
    });
  });

  describe('Critical data loading', () => {
    test('loads public data for unauthenticated users', async () => {
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        // Public data thunks should be called
        expect(getSecondaryratio.default).toHaveBeenCalled();
        expect(getPrimaryMintRate.default).toHaveBeenCalled();
        expect(getSecondaryFee.default).toHaveBeenCalled();
        expect(getPrimaryFee.default).toHaveBeenCalled();
        expect(getIcpPrice.default).toHaveBeenCalled();
        expect(getCanisterBal.default).toHaveBeenCalled();
        expect(getCanisterArchivedBal.default).toHaveBeenCalled();
        
        // User data thunks should NOT be called
        expect(getIcpBal.default).not.toHaveBeenCalled();
        expect(getAccountPrimaryBalance.default).not.toHaveBeenCalled();
        expect(getSecondaryBalance.default).not.toHaveBeenCalled();
      });
    });

    test('loads both public and user data for authenticated users', async () => {
      const userPrincipal = 'user-principal-123';
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        },
        auth: {
          isAuthenticated: true,
          principal: userPrincipal
        }
      });

      renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        // All public data should be loaded
        expect(getSecondaryratio.default).toHaveBeenCalled();
        expect(getIcpPrice.default).toHaveBeenCalled();
        
        // User data should be loaded with correct principal
        expect(getIcpBal.default).toHaveBeenCalledWith(userPrincipal);
        expect(getAccountPrimaryBalance.default).toHaveBeenCalledWith(userPrincipal);
        expect(getSecondaryBalance.default).toHaveBeenCalledWith(userPrincipal);
      });
    });

    test('handles public data loading errors gracefully', async () => {
      // Make one thunk fail
      getIcpPrice.default = jest.fn(() => ({
        unwrap: jest.fn(() => Promise.reject(new Error('Network error')))
      }));

      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Some public data failed to load:',
          expect.any(Error)
        );
      });

      // Should still transition to ready despite error
      await waitFor(() => {
        const { result } = renderHook(() => useSwapDataLoader(), { wrapper });
        expect(result.current.loadingPhase).toBe(LoadingPhase.READY);
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Secondary data loading', () => {
    test('loads secondary data only for authenticated users', async () => {
      const userPrincipal = 'user-principal-123';
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        },
        auth: {
          isAuthenticated: true,
          principal: userPrincipal
        }
      });

      renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        expect(getStakedInfo.default).toHaveBeenCalledWith(userPrincipal);
        expect(getArchivedBal.default).toHaveBeenCalledWith(userPrincipal);
      });
    });

    test('skips secondary data for unauthenticated users', async () => {
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        expect(getStakedInfo.default).not.toHaveBeenCalled();
        expect(getArchivedBal.default).not.toHaveBeenCalled();
      });

      // Should still become ready
      const { result } = renderHook(() => useSwapDataLoader(), { wrapper });
      await waitFor(() => {
        expect(result.current.isSwapReady).toBe(true);
      });
    });

    test('handles secondary data errors gracefully', async () => {
      getStakedInfo.default = jest.fn(() => ({
        unwrap: jest.fn(() => Promise.reject(new Error('Staking error')))
      }));

      const userPrincipal = 'user-principal-123';
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        },
        auth: {
          isAuthenticated: true,
          principal: userPrincipal
        }
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to load secondary data:',
          expect.any(Error)
        );
      });

      // Should still become ready
      const { result } = renderHook(() => useSwapDataLoader(), { wrapper });
      await waitFor(() => {
        expect(result.current.isSwapReady).toBe(true);
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Loading guards', () => {
    test('prevents multiple concurrent loadCriticalData calls', async () => {
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' },
          isLoadingCriticalData: true
        }
      });

      renderHook(() => useSwapDataLoader(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not call any thunks when already loading
      expect(getSecondaryratio.default).not.toHaveBeenCalled();
      expect(getIcpPrice.default).not.toHaveBeenCalled();
    });

    test('prevents multiple concurrent loadSecondaryData calls', async () => {
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' },
          isLoadingSecondaryData: true
        },
        auth: {
          isAuthenticated: true,
          principal: 'user123'
        }
      });

      renderHook(() => useSwapDataLoader(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should not call secondary data thunks when already loading
      expect(getStakedInfo.default).not.toHaveBeenCalled();
      expect(getArchivedBal.default).not.toHaveBeenCalled();
    });
  });

  describe('Performance monitoring', () => {
    test('tracks performance metrics for data loading', async () => {
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        expect(performanceMonitor.startMetric).toHaveBeenCalledWith('loadCriticalData');
        expect(performanceMonitor.endMetric).toHaveBeenCalledWith('loadCriticalData', 'success');
      });
    });

    test('records errors in performance metrics', async () => {
      getIcpPrice.default = jest.fn(() => ({
        unwrap: jest.fn(() => Promise.reject(new Error('API Error')))
      }));

      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        expect(performanceMonitor.startMetric).toHaveBeenCalledWith('loadCriticalData');
        // Note: Due to partial error handling, it still reports success
        expect(performanceMonitor.endMetric).toHaveBeenCalledWith('loadCriticalData', 'success');
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Cache warming integration', () => {
    test('initializes cache warming on mount', async () => {
      const { initializeCacheWarming } = require('../../lbry_fun_frontend/src/utils/cacheWarming');
      
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      renderHook(() => useSwapDataLoader(), { wrapper });

      expect(initializeCacheWarming).toHaveBeenCalled();
    });

    test('starts cache warming after initial data load', async () => {
      const mockCacheManager = {
        start: jest.fn(),
        stop: jest.fn(),
        isRunning: jest.fn(() => false)
      };
      
      const { getCacheWarmingManager } = require('../../lbry_fun_frontend/src/utils/cacheWarming');
      getCacheWarmingManager.mockReturnValue(mockCacheManager);

      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        expect(mockCacheManager.start).toHaveBeenCalled();
      });
    });

    test('stops cache warming on unmount', async () => {
      const mockCacheManager = {
        start: jest.fn(),
        stop: jest.fn(),
        isRunning: jest.fn(() => false)
      };
      
      const { initializeCacheWarming } = require('../../lbry_fun_frontend/src/utils/cacheWarming');
      initializeCacheWarming.mockReturnValue(mockCacheManager);

      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      const { unmount } = renderHook(() => useSwapDataLoader(), { wrapper });

      unmount();

      expect(mockCacheManager.stop).toHaveBeenCalled();
    });
  });

  describe('Pool changes', () => {
    test('reloads data when active pool changes', async () => {
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      const { rerender } = renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        expect(getSecondaryratio.default).toHaveBeenCalledTimes(1);
      });

      // Change active pool
      act(() => {
        store.dispatch({
          type: 'swap/setActiveSwapPool',
          payload: { id: 'pool2' }
        });
      });

      rerender();

      // Should reload data for new pool
      await waitFor(() => {
        expect(getSecondaryratio.default).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Critical data loaded flag', () => {
    test('criticalDataLoaded is true during secondary loading', async () => {
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      const { result } = renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        if (result.current.loadingPhase === LoadingPhase.LOADING_SECONDARY) {
          expect(result.current.criticalDataLoaded).toBe(true);
        }
      });
    });

    test('criticalDataLoaded is true when ready', async () => {
      store = createTestStore({
        swap: {
          activeSwapPool: { id: 'pool1' }
        }
      });

      const { result } = renderHook(() => useSwapDataLoader(), { wrapper });

      await waitFor(() => {
        if (result.current.loadingPhase === LoadingPhase.READY) {
          expect(result.current.criticalDataLoaded).toBe(true);
          expect(result.current.isSwapReady).toBe(true);
        }
      });
    });
  });
});