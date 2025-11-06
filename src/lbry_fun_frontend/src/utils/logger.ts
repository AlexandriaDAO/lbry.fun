/**
 * Smart Logger Utility
 * Development-only logging with grouping and filtering
 */

const isDevelopment = process.env.NODE_ENV === 'development';

// Track repeated messages to avoid spam
const messageCount = new Map<string, number>();
const MESSAGE_THROTTLE = 10; // Only show first N of same message

class Logger {
  private enabled: boolean;

  constructor() {
    this.enabled = isDevelopment && !process.env.DISABLE_LOGGING;
  }

  log(category: string, message: string, ...args: any[]) {
    if (!this.enabled) return;

    const key = `${category}:${message}`;
    const count = messageCount.get(key) || 0;

    if (count < MESSAGE_THROTTLE) {
      console.log(`[${category}]`, message, ...args);
      messageCount.set(key, count + 1);
    } else if (count === MESSAGE_THROTTLE) {
      console.log(`[${category}] (Suppressing further identical messages...)`);
      messageCount.set(key, count + 1);
    }
  }

  debug(category: string, message: string, ...args: any[]) {
    if (!this.enabled || !process.env.DEBUG) return;
    console.debug(`[${category}]`, message, ...args);
  }

  error(category: string, message: string, error?: any) {
    // Always log errors, even in production
    console.error(`[${category}]`, message, error);
  }

  warn(category: string, message: string, ...args: any[]) {
    if (!this.enabled) return;
    console.warn(`[${category}]`, message, ...args);
  }

  group(category: string, fn: () => void) {
    if (!this.enabled) {
      fn();
      return;
    }

    console.group(`[${category}]`);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }

  clear() {
    messageCount.clear();
  }
}

// Singleton instance
export const logger = new Logger();

// Category constants for consistency
export const LogCategories = {
  AUTH: 'Auth',
  ACTOR: 'Actor',
  IDENTITY: 'Identity',
  NETWORK: 'Network',
  CHUNK: 'Chunk',
  STATE: 'State',
  SWAP: 'Swap',
  ERROR: 'Error'
} as const;