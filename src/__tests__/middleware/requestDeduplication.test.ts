import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from '@reduxjs/toolkit';
import { requestDeduplicationMiddleware, clearPendingRequests } from '../../lbry_fun_frontend/src/features/swap/middleware/requestDeduplication';

// Mock store
const createMockStore = () => ({
  getState: jest.fn(),
  dispatch: jest.fn()
});

// Mock next function
const createMockNext = (): Dispatch<AnyAction> => jest.fn((action) => action);

describe('Request Deduplication Middleware', () => {
  let store: MiddlewareAPI;
  let next: Dispatch<AnyAction>;
  let middleware: ReturnType<Middleware>;

  beforeEach(() => {
    store = createMockStore() as unknown as MiddlewareAPI;
    next = createMockNext();
    middleware = requestDeduplicationMiddleware(store)(next);
    clearPendingRequests();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic functionality', () => {
    test('passes through non-pending actions', () => {
      const action = { type: 'someAction' };
      const result = middleware(action);
      
      expect(next).toHaveBeenCalledWith(action);
      expect(result).toBeDefined();
    });

    test('passes through fulfilled actions', () => {
      const action = { type: 'swap/getIcpPrice/fulfilled', payload: 100 };
      const result = middleware(action);
      
      expect(next).toHaveBeenCalledWith(action);
      expect(result).toBeDefined();
    });

    test('passes through rejected actions', () => {
      const action = { type: 'swap/getIcpPrice/rejected', error: 'Failed' };
      const result = middleware(action);
      
      expect(next).toHaveBeenCalledWith(action);
      expect(result).toBeDefined();
    });
  });

  describe('Deduplication logic', () => {
    test('prevents duplicate pending requests', () => {
      const action = {
        type: 'icp_swap/getSecondaryratio/pending',
        meta: { arg: undefined }
      };
      
      // First call should go through
      const result1 = middleware(action);
      expect(next).toHaveBeenCalledTimes(1);
      expect(result1).toBeDefined();
      
      // Second call should be blocked
      const result2 = middleware(action);
      expect(next).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toBeUndefined();
    });

    test('allows requests after cache expiry', () => {
      const action = {
        type: 'icp_swap/getSecondaryratio/pending',
        meta: { arg: undefined }
      };
      
      // First request
      middleware(action);
      expect(next).toHaveBeenCalledTimes(1);
      
      // Advance time past cache duration (10 seconds)
      jest.advanceTimersByTime(11000);
      
      // Second request should go through
      middleware(action);
      expect(next).toHaveBeenCalledTimes(2);
    });

    test('handles different request arguments as separate requests', () => {
      const action1 = {
        type: 'swap/getBalance/pending',
        meta: { arg: 'principal1' }
      };
      
      const action2 = {
        type: 'swap/getBalance/pending',
        meta: { arg: 'principal2' }
      };
      
      middleware(action1);
      middleware(action2);
      
      expect(next).toHaveBeenCalledTimes(2);
    });

    test('deduplicates requests with same arguments', () => {
      const action = {
        type: 'swap/getBalance/pending',
        meta: { arg: 'principal1' }
      };
      
      middleware(action);
      middleware(action);
      
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Never deduplicate actions', () => {
    const neverDeduplicateActions = [
      'swap/swapSecondary/pending',
      'swap/burnSecondary/pending',
      'swap/stakePrimary/pending',
      'swap/transferSecondary/pending'
    ];

    test.each(neverDeduplicateActions)('never deduplicates %s', (actionType) => {
      const action = {
        type: actionType,
        meta: { arg: { amount: 100 } }
      };
      
      // Call multiple times
      middleware(action);
      middleware(action);
      middleware(action);
      
      // All should go through
      expect(next).toHaveBeenCalledTimes(3);
    });
  });

  describe('Request key generation', () => {
    test('generates consistent keys for ICP price requests', () => {
      const action1 = {
        type: 'swap/getIcpPrice/pending',
        meta: { arg: undefined }
      };
      
      const action2 = {
        type: 'swap/getIcpPrice/pending',
        meta: { arg: null }
      };
      
      // Both should be deduplicated as the same request
      middleware(action1);
      middleware(action2);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('generates unique keys for balance requests', () => {
      const principals = ['principal1', 'principal2', 'principal3'];
      
      principals.forEach(principal => {
        const action = {
          type: 'swap/getBalance/pending',
          meta: { arg: principal }
        };
        middleware(action);
      });
      
      expect(next).toHaveBeenCalledTimes(3);
    });

    test('handles object arguments with userPrincipal', () => {
      const action1 = {
        type: 'swap/someAction/pending',
        meta: { arg: { userPrincipal: 'user1', amount: 100 } }
      };
      
      const action2 = {
        type: 'swap/someAction/pending',
        meta: { arg: { userPrincipal: 'user1', amount: 200 } }
      };
      
      const action3 = {
        type: 'swap/someAction/pending',
        meta: { arg: { userPrincipal: 'user2', amount: 100 } }
      };
      
      middleware(action1);
      middleware(action2); // Same user, should be deduplicated
      middleware(action3); // Different user, should go through
      
      expect(next).toHaveBeenCalledTimes(2);
    });

    test('handles complex object arguments', () => {
      const action1 = {
        type: 'swap/complexAction/pending',
        meta: { arg: { a: 1, b: 2 } }
      };
      
      const action2 = {
        type: 'swap/complexAction/pending',
        meta: { arg: { a: 1, b: 2 } }
      };
      
      const action3 = {
        type: 'swap/complexAction/pending',
        meta: { arg: { a: 1, b: 3 } }
      };
      
      middleware(action1);
      middleware(action2); // Same args, deduplicated
      middleware(action3); // Different args, goes through
      
      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cleanup and memory management', () => {
    test('automatically cleans up expired requests', () => {
      const action = {
        type: 'swap/getBalance/pending',
        meta: { arg: 'principal1' }
      };
      
      middleware(action);
      
      // Should be deduplicated before cleanup
      middleware(action);
      expect(next).toHaveBeenCalledTimes(1);
      
      // Advance time to trigger cleanup
      jest.advanceTimersByTime(10000);
      
      // Should go through after cleanup
      middleware(action);
      expect(next).toHaveBeenCalledTimes(2);
    });

    test('clearPendingRequests clears all pending requests', () => {
      const action1 = {
        type: 'swap/action1/pending',
        meta: { arg: undefined }
      };
      
      const action2 = {
        type: 'swap/action2/pending',
        meta: { arg: undefined }
      };
      
      middleware(action1);
      middleware(action2);
      
      clearPendingRequests();
      
      // Both should go through after clearing
      middleware(action1);
      middleware(action2);
      
      expect(next).toHaveBeenCalledTimes(4);
    });
  });

  describe('Edge cases', () => {
    test('handles actions without meta property', () => {
      const action = {
        type: 'swap/someAction/pending'
      };
      
      const result = middleware(action);
      expect(next).toHaveBeenCalledWith(action);
      expect(result).toBeDefined();
    });

    test('handles actions with null meta.arg', () => {
      const action = {
        type: 'swap/someAction/pending',
        meta: { arg: null }
      };
      
      middleware(action);
      middleware(action);
      
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('handles concurrent requests correctly', () => {
      const actions = Array.from({ length: 10 }, (_, i) => ({
        type: 'swap/getBalance/pending',
        meta: { arg: `principal${i % 3}` } // 3 unique principals
      }));
      
      actions.forEach(action => middleware(action));
      
      // Should only process 3 unique requests
      expect(next).toHaveBeenCalledTimes(3);
    });
  });

  describe('Console logging', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    test('logs when skipping duplicate requests', () => {
      const action = {
        type: 'swap/getBalance/pending',
        meta: { arg: 'principal1' }
      };
      
      middleware(action);
      middleware(action);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Deduplication] 🚫 Skipping duplicate request')
      );
    });

    test('logs when processing new requests', () => {
      const action = {
        type: 'swap/getBalance/pending',
        meta: { arg: 'principal1' }
      };
      
      middleware(action);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Deduplication] ✅ Processing request')
      );
    });

    test('logs cache statistics', () => {
      const action = {
        type: 'swap/getBalance/pending',
        meta: { arg: 'principal1' }
      };
      
      middleware(action);
      middleware(action);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Deduplication] 📊 Stats:')
      );
    });
  });

  describe('Performance', () => {
    test('handles high volume of requests efficiently', () => {
      const start = performance.now();
      
      // Simulate 1000 requests with 10 unique keys
      for (let i = 0; i < 1000; i++) {
        const action = {
          type: 'swap/getBalance/pending',
          meta: { arg: `principal${i % 10}` }
        };
        middleware(action);
      }
      
      const duration = performance.now() - start;
      
      // Should process in under 50ms
      expect(duration).toBeLessThan(50);
      // Should only process 10 unique requests
      expect(next).toHaveBeenCalledTimes(10);
    });

    test('memory usage remains bounded', () => {
      // Create many unique requests
      for (let i = 0; i < 100; i++) {
        const action = {
          type: 'swap/getBalance/pending',
          meta: { arg: `principal${i}` }
        };
        middleware(action);
      }
      
      // Advance time to trigger cleanup
      jest.advanceTimersByTime(10000);
      
      // All requests should be cleaned up
      // New requests should go through
      for (let i = 0; i < 100; i++) {
        const action = {
          type: 'swap/getBalance/pending',
          meta: { arg: `principal${i}` }
        };
        middleware(action);
      }
      
      // Should have processed 200 requests total
      expect(next).toHaveBeenCalledTimes(200);
    });
  });
});