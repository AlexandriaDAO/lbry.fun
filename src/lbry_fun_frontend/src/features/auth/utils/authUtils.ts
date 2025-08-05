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

export const getPrincipal = (client: AuthClient): string =>
  client.getIdentity().getPrincipal().toString();

export const getAuthClient = async (): Promise<AuthClient> => {
  // create new client each time inspired by default react app
  // https://gitlab.com/kurdy/dfx_base/-/blob/main/src/dfx_base_frontend/src/services/auth.ts?ref_type=heads

  // reason for creating new client each time is
  // if the user login has expired it will SPA will not know
  // as same client's ( isAuthenticated ) will always return true even if user session is expired
  const authClient = await AuthClient.create();

  return authClient;
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
    if (await client.isAuthenticated()) {
      const identity = client.getIdentity();

      const agent = await HttpAgent.create({
        identity,
        host: isLocalDevelopment
          ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943` // Local development URL - hardcoded II canister ID
          : "https://identity.ic0.app", // Default to mainnet if neither condition is true
      });

      // Fetch root key for certificate validation during development
      // dangerous on mainnet
      if (isLocalDevelopment) {
        await agent.fetchRootKey().catch((err) => {
          console.warn(
            "Unable to fetch root key. Check to ensure that your local replica is running"
          );
          console.error(err);
        });
      }

      const actor = createActorFn(canisterId, {
        agent,
      });

      // Wrap actor with error handler
      return wrapActorWithErrorHandler(actor);
    }
  } catch (error) {
    console.error(`Error initializing actor for ${canisterId}:`, error);
  }
  return defaultActor;
};



export const getActorSwap = async (canisterId:string) => {
  // For dynamically spawned canisters, always create a new actor
  // Don't fall back to the template actor which may be undefined
  const client = await getAuthClient();
  if (await client.isAuthenticated()) {
    const identity = client.getIdentity();
    const agent = await HttpAgent.create({
      identity,
      host: isLocalDevelopment
        ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943` // hardcoded II canister ID
        : "https://identity.ic0.app",
    });
    
    if (isLocalDevelopment) {
      await agent.fetchRootKey().catch((err) => {
        console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
        console.error(err);
      });
    }
    
    return wrapActorWithErrorHandler(createActorSwap(canisterId, { agent }));
  }
  
  // For unauthenticated access, create actor with anonymous identity
  const agent = await HttpAgent.create({
    host: isLocalDevelopment
      ? `http://localhost:4943`
      : "https://ic0.app",
  });
  
  if (isLocalDevelopment) {
    await agent.fetchRootKey().catch(() => {});
  }
  
  return wrapActorWithErrorHandler(createActorSwap(canisterId, { agent }));
};

export const getIcpLedgerActor = () =>
  getActor(icp_ledger_canister_id, createActorIcpLedger, icp_ledger_canister);

export const getTokenomicsActor = async (canisterId:string) => {
  // For dynamically spawned canisters, always create a new actor
  const client = await getAuthClient();
  if (await client.isAuthenticated()) {
    const identity = client.getIdentity();
    const agent = await HttpAgent.create({
      identity,
      host: isLocalDevelopment
        ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943` // hardcoded II canister ID
        : "https://identity.ic0.app",
    });
    
    if (isLocalDevelopment) {
      await agent.fetchRootKey().catch((err) => {
        console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
        console.error(err);
      });
    }
    
    return wrapActorWithErrorHandler(createActorTokenomics(canisterId, { agent }));
  }
  
  // For unauthenticated access, create actor with anonymous identity
  const agent = await HttpAgent.create({
    host: isLocalDevelopment
      ? `http://localhost:4943`
      : "https://ic0.app",
  });
  
  if (isLocalDevelopment) {
    await agent.fetchRootKey().catch(() => {});
  }
  
  return wrapActorWithErrorHandler(createActorTokenomics(canisterId, { agent }));
};

export const getICRCActor = async (canisterId:string) => {
  // For dynamically spawned canisters, always create a new actor
  const client = await getAuthClient();
  if (await client.isAuthenticated()) {
    const identity = client.getIdentity();
    const agent = await HttpAgent.create({
      identity,
      host: isLocalDevelopment
        ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943` // hardcoded II canister ID
        : "https://identity.ic0.app",
    });
    
    if (isLocalDevelopment) {
      await agent.fetchRootKey().catch((err) => {
        console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
        console.error(err);
      });
    }
    
    return wrapActorWithErrorHandler(createActorICRC(canisterId, { agent }));
  }
  
  // For unauthenticated access, create actor with anonymous identity
  const agent = await HttpAgent.create({
    host: isLocalDevelopment
      ? `http://localhost:4943`
      : "https://ic0.app",
  });
  
  if (isLocalDevelopment) {
    await agent.fetchRootKey().catch(() => {});
  }
  
  return wrapActorWithErrorHandler(createActorICRC(canisterId, { agent }));
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