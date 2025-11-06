import { Actor, HttpAgent, Identity } from "@dfinity/agent";
import { isIdentityExpired } from "@/utils/general";
import { toast } from "sonner";

import {
  icp_swap,
  createActor as createActorSwap,
} from "../../../../../declarations/icp_swap";
import {
  icp_ledger_canister,
  createActor as createActorIcpLedger,
} from "../../../../../declarations/icp_ledger_canister";
import {
  tokenomics,
  createActor as createActorTokenomics,
} from "../../../../../declarations/tokenomics";
import {
  ICRC,
  createActor as createActorICRC,
} from "../../../../../ICRC";

import {
  logs,
  createActor as createActorLogs,
} from "../../../../../declarations/logs";
import {
  lbry_fun,
  createActor as createActorLbryFun,
} from "../../../../../declarations/lbry_fun";

const isLocalDevelopment = process.env.DFX_NETWORK !== "ic";

const alex_backend_canister_id = process.env.CANISTER_ID_ALEX_BACKEND!;
const icp_swap_canister_id = process.env.CANISTER_ID_ICP_SWAP!;
const icp_ledger_canister_id = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const tokenomics_canister_id = process.env.CANISTER_ID_TOKENOMICS!;
const user_canister_id = process.env.CANISTER_ID_USER!;
const log_canister_id = process.env.CANISTER_ID_LOGS!;
const icp_swap_factory_canister_id = "ggzvv-5qaaa-aaaag-qck7a-cai";
const lbry_fun_canister_id = process.env.CANISTER_ID_LBRY_FUN!;

// Store for getting current identity from ic-use-internet-identity
let getIdentityFunc: (() => Identity | undefined) | null = null;

// Singleton HttpAgent instance
let cachedAgent: HttpAgent | null = null;
let cachedIdentity: Identity | undefined = undefined;

// Register a function to get the current identity
export const registerIdentityGetter = (getter: () => Identity | undefined) => {
  getIdentityFunc = getter;
};

// Get current identity from ic-use-internet-identity
export const getCurrentIdentity = (): Identity | undefined => {
  if (!getIdentityFunc) {
    return undefined;
  }
  const identity = getIdentityFunc();
  return identity;
};

// Clear function when logging out (NOT when unmounting)
export const clearAuthCaches = () => {
  // Clear cached agent when identity changes
  cachedAgent = null;
  cachedIdentity = undefined;
  // Don't clear getIdentityFunc here - let IdentityBridge manage it
};

// Get or create singleton HttpAgent
const getOrCreateAgent = async (): Promise<HttpAgent> => {
  const currentIdentity = getCurrentIdentity();

  // If identity changed or no cached agent, create new one
  if (cachedIdentity !== currentIdentity || !cachedAgent) {
    const agentOptions: { identity?: Identity; host?: string } = {};
    agentOptions.host = isLocalDevelopment
      ? `http://localhost:4943`
      : "https://ic0.app";

    if (currentIdentity) {
      agentOptions.identity = currentIdentity;
    }

    cachedAgent = new HttpAgent(agentOptions);
    cachedIdentity = currentIdentity;

    // Fetch root key for new agent if in development
    if (isLocalDevelopment) {
      await cachedAgent.fetchRootKey().catch((err) => {
        console.warn(
          "Unable to fetch root key. Check to ensure that your local replica is running"
        );
        console.error(err);
      });
    }
  }

  return cachedAgent;
};

// Helper function to wrap actors with identity expiration handling
const wrapActorWithErrorHandler = <T>(actor: T): T => {
  return new Proxy(actor, {
    get(target: any, prop: string | symbol, receiver: any) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return async (...args: any[]) => {
          try {
            return await value.apply(target, args);
          } catch (error) {
            if (isIdentityExpired(error)) {
              console.error('Identity expired in direct actor call:', error);
              toast.error('Session expired.');
              setTimeout(() => {
                window.location.reload();
              }, 2000);
              throw error;
            }
            throw error;
          }
        };
      }
      return value;
    }
  }) as T;
};

// Generic actor creation WITHOUT caching (let ic-use-actor handle caching)
const getActor = async <T>(
  canisterId: string,
  createActorFn: (canisterId: string, options: { agent: HttpAgent }) => T
): Promise<T> => {
  if (!canisterId) {
    throw new Error("[authUtils.getActor] Canister ID cannot be null or empty.");
  }

  try {
    const agent = await getOrCreateAgent();
    const actor = createActorFn(canisterId, { agent });
    return wrapActorWithErrorHandler(actor);
  } catch (error) {
    console.error(`[authUtils.getActor] Error initializing actor for ${canisterId}:`, error);
    throw error;
  }
};

export const getActorSwap = async (canisterId: string) => {
  const agent = await getOrCreateAgent();
  return wrapActorWithErrorHandler(createActorSwap(canisterId, { agent }));
};

// Removed - use useIcpLedger hook instead
// export const getIcpLedgerActor = () =>
//   getActor(icp_ledger_canister_id, createActorIcpLedger);

export const getTokenomicsActor = async (canisterId: string) => {
  const agent = await getOrCreateAgent();
  return wrapActorWithErrorHandler(createActorTokenomics(canisterId, { agent }));
};

// Export the ICP Ledger actor getter for components that still need it
export const getIcpLedgerActor = async () => {
  const agent = await getOrCreateAgent();
  return wrapActorWithErrorHandler(createActorIcpLedger(icp_ledger_canister_id, { agent }));
};

export const getICRCActor = async (canisterId: string) => {
  const agent = await getOrCreateAgent();
  return wrapActorWithErrorHandler(createActorICRC(canisterId, { agent }));
};

export const getLogs = () => getActor(log_canister_id, createActorLogs);
// Removed - use useLbryFun hook instead
// export const getLbryFunActor = () => {
//   if (!lbry_fun_canister_id) {
//     console.error("CANISTER_ID_LBRY_FUN is not defined in environment variables");
//   }
//   return getActor(lbry_fun_canister_id, createActorLbryFun);
// };

// Compatibility functions for existing code
export const getAuthClient = async () => {
  // This is now a no-op, returning a mock that uses the identity from ic-use-internet-identity
  const identity = getCurrentIdentity();
  return {
    isAuthenticated: async () => !!identity,
    getIdentity: () => identity || { getPrincipal: () => ({ toString: () => '2vxsx-fae' }) },
    logout: async () => {
      // Handled by ic-use-internet-identity
    }
  };
};

export const getPrincipal = (client: any): string => {
  const identity = getCurrentIdentity();
  return identity ? identity.getPrincipal().toString() : '2vxsx-fae';
};

// Helper function to check if user is authenticated
export const isUserAuthenticated = async (): Promise<boolean> => {
  const identity = getCurrentIdentity();
  return !!identity && identity.getPrincipal().toString() !== '2vxsx-fae';
};

// Helper function to validate actor before use
export const validateActor = <T>(actor: T, actorName: string): boolean => {
  if (!actor || typeof actor !== 'object') {
    console.warn(`${actorName} actor is undefined or invalid. User may not be authenticated.`);
    return false;
  }
  return true;
};