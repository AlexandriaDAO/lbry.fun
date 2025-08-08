import { Actor, HttpAgent, Identity } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
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

// --- Caching Variables ---
let authClientInstance: AuthClient | null = null;
const agentCache = new Map<string, HttpAgent>();
const actorCache = new Map<string, any>();
const agentsFetchedRootKey = new WeakSet<HttpAgent>();
// --- End Caching Variables ---

export const getPrincipal = (client: AuthClient): string =>
  client.getIdentity().getPrincipal().toString();

export const getAuthClient = async (): Promise<AuthClient> => {
  // Use cached instance if available to maintain consistency with ic-use-internet-identity
  if (authClientInstance) {
    return authClientInstance;
  }
  authClientInstance = await AuthClient.create();
  return authClientInstance;
};

// Clear all caches when logging out or session expires
export const clearAuthCaches = () => {
  authClientInstance = null;
  agentCache.clear();
  actorCache.clear();
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
              setTimeout(async () => {
                // Clear auth and reload
                const authClient = await getAuthClient();
                await authClient.logout();
                clearAuthCaches();
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

const getActor = async <T>(
  canisterId: string,
  createActorFn: (canisterId: string, options: { agent: HttpAgent }) => T,
  defaultActor: T
): Promise<T> => {
  try {
    const client = await getAuthClient();
    const isAuthenticated = await client.isAuthenticated();
    const principalString = isAuthenticated
      ? client.getIdentity().getPrincipal().toString()
      : "ANONYMOUS";

    // Check actor cache first
    const actorCacheKey = `${canisterId}_${principalString}`;
    if (actorCache.has(actorCacheKey)) {
      return actorCache.get(actorCacheKey) as T;
    }

    if (isAuthenticated) {
      const identity = client.getIdentity();
      
      // Check agent cache
      let agent: HttpAgent;
      const agentCacheKey = principalString;
      
      if (agentCache.has(agentCacheKey)) {
        agent = agentCache.get(agentCacheKey)!;
      } else {
        agent = await HttpAgent.create({
          identity,
          host: isLocalDevelopment
            ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943` // Local development URL - hardcoded II canister ID
            : "https://identity.ic0.app",
        });
        
        agentCache.set(agentCacheKey, agent);

        // Fetch root key for certificate validation during development
        // dangerous on mainnet
        if (isLocalDevelopment && !agentsFetchedRootKey.has(agent)) {
          await agent.fetchRootKey().catch((err) => {
            console.warn(
              "Unable to fetch root key. Check to ensure that your local replica is running"
            );
            console.error(err);
          });
          agentsFetchedRootKey.add(agent);
        }
      }

      const actor = createActorFn(canisterId, { agent });
      const wrappedActor = wrapActorWithErrorHandler(actor);
      
      // Cache the actor
      actorCache.set(actorCacheKey, wrappedActor);
      return wrappedActor;
    }
  } catch (error) {
    console.error(`Error initializing actor for ${canisterId}:`, error);
  }
  return defaultActor;
};



export const getActorSwap = async (canisterId:string) => {
  // Use the same caching pattern as getActor
  const client = await getAuthClient();
  const isAuthenticated = await client.isAuthenticated();
  const principalString = isAuthenticated
    ? client.getIdentity().getPrincipal().toString()
    : "ANONYMOUS";

  // Check actor cache first
  const actorCacheKey = `swap_${canisterId}_${principalString}`;
  if (actorCache.has(actorCacheKey)) {
    return actorCache.get(actorCacheKey);
  }

  let agent: HttpAgent;
  const agentCacheKey = principalString;
  
  if (agentCache.has(agentCacheKey)) {
    agent = agentCache.get(agentCacheKey)!;
  } else {
    const agentOptions: any = {};
    if (isAuthenticated) {
      agentOptions.identity = client.getIdentity();
      agentOptions.host = isLocalDevelopment
        ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943`
        : "https://identity.ic0.app";
    } else {
      agentOptions.host = isLocalDevelopment
        ? `http://localhost:4943`
        : "https://ic0.app";
    }
    
    agent = await HttpAgent.create(agentOptions);
    agentCache.set(agentCacheKey, agent);
    
    if (isLocalDevelopment && !agentsFetchedRootKey.has(agent)) {
      await agent.fetchRootKey().catch((err) => {
        console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
        console.error(err);
      });
      agentsFetchedRootKey.add(agent);
    }
  }
  
  const actor = wrapActorWithErrorHandler(createActorSwap(canisterId, { agent }));
  actorCache.set(actorCacheKey, actor);
  return actor;
};

export const getIcpLedgerActor = () =>
  getActor(icp_ledger_canister_id, createActorIcpLedger, icp_ledger_canister);

export const getTokenomicsActor = async (canisterId:string) => {
  // Use the same caching pattern as getActor
  const client = await getAuthClient();
  const isAuthenticated = await client.isAuthenticated();
  const principalString = isAuthenticated
    ? client.getIdentity().getPrincipal().toString()
    : "ANONYMOUS";

  // Check actor cache first
  const actorCacheKey = `tokenomics_${canisterId}_${principalString}`;
  if (actorCache.has(actorCacheKey)) {
    return actorCache.get(actorCacheKey);
  }

  let agent: HttpAgent;
  const agentCacheKey = principalString;
  
  if (agentCache.has(agentCacheKey)) {
    agent = agentCache.get(agentCacheKey)!;
  } else {
    const agentOptions: any = {};
    if (isAuthenticated) {
      agentOptions.identity = client.getIdentity();
      agentOptions.host = isLocalDevelopment
        ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943`
        : "https://identity.ic0.app";
    } else {
      agentOptions.host = isLocalDevelopment
        ? `http://localhost:4943`
        : "https://ic0.app";
    }
    
    agent = await HttpAgent.create(agentOptions);
    agentCache.set(agentCacheKey, agent);
    
    if (isLocalDevelopment && !agentsFetchedRootKey.has(agent)) {
      await agent.fetchRootKey().catch((err) => {
        console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
        console.error(err);
      });
      agentsFetchedRootKey.add(agent);
    }
  }
  
  const actor = wrapActorWithErrorHandler(createActorTokenomics(canisterId, { agent }));
  actorCache.set(actorCacheKey, actor);
  return actor;
};

export const getICRCActor = async (canisterId:string) => {
  // Use the same caching pattern as getActor
  const client = await getAuthClient();
  const isAuthenticated = await client.isAuthenticated();
  const principalString = isAuthenticated
    ? client.getIdentity().getPrincipal().toString()
    : "ANONYMOUS";

  // Check actor cache first
  const actorCacheKey = `icrc_${canisterId}_${principalString}`;
  if (actorCache.has(actorCacheKey)) {
    return actorCache.get(actorCacheKey);
  }

  let agent: HttpAgent;
  const agentCacheKey = principalString;
  
  if (agentCache.has(agentCacheKey)) {
    agent = agentCache.get(agentCacheKey)!;
  } else {
    const agentOptions: any = {};
    if (isAuthenticated) {
      agentOptions.identity = client.getIdentity();
      agentOptions.host = isLocalDevelopment
        ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943`
        : "https://identity.ic0.app";
    } else {
      agentOptions.host = isLocalDevelopment
        ? `http://localhost:4943`
        : "https://ic0.app";
    }
    
    agent = await HttpAgent.create(agentOptions);
    agentCache.set(agentCacheKey, agent);
    
    if (isLocalDevelopment && !agentsFetchedRootKey.has(agent)) {
      await agent.fetchRootKey().catch((err) => {
        console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
        console.error(err);
      });
      agentsFetchedRootKey.add(agent);
    }
  }
  
  const actor = wrapActorWithErrorHandler(createActorICRC(canisterId, { agent }));
  actorCache.set(actorCacheKey, actor);
  return actor;
};


export const getLogs = () => getActor(log_canister_id, createActorLogs, logs);
export const getLbryFunActor = () => {
  if (!lbry_fun_canister_id) {
    console.error("CANISTER_ID_LBRY_FUN is not defined in environment variables");
  } else {
    console.log("Using LBRY_FUN canister ID:", lbry_fun_canister_id);
  }
  return getActor(lbry_fun_canister_id, createActorLbryFun, lbry_fun);
};

// Helper function to check if user is authenticated
export const isUserAuthenticated = async (): Promise<boolean> => {
  try {
    const client = await getAuthClient();
    return await client.isAuthenticated();
  } catch (error) {
    console.error("Error checking authentication status:", error);
    return false;
  }
};

// Helper function to validate actor before use
export const validateActor = <T>(actor: T, actorName: string): boolean => {
  if (!actor || typeof actor !== 'object') {
    console.warn(`${actorName} actor is undefined or invalid. User may not be authenticated.`);
    return false;
  }
  return true;
};