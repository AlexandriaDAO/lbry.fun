import { HttpAgent } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { icp_swap, createActor as createActorSwap, } from "../../../../../declarations/icp_swap";
import { icp_ledger_canister, createActor as createActorIcpLedger, } from "../../../../../declarations/icp_ledger_canister";
import { tokenomics, createActor as createActorTokenomics, } from "../../../../../declarations/tokenomics";
import { ICRC, createActor as createActorICRC, } from "../../../../../ICRC";
import { logs, createActor as createActorLogs, } from "../../../../../declarations/logs";
import { icp_swap_factory, createActor as createActorIcpSwapFactory, } from "../../../../../icp_swap_factory";
import { lbry_fun, createActor as createActorLbryFun, } from "../../../../../declarations/lbry_fun";
const isLocalDevelopment = process.env.DFX_NETWORK !== "ic";
const alex_backend_canister_id = process.env.CANISTER_ID_ALEX_BACKEND;
const icp_swap_canister_id = process.env.CANISTER_ID_ICP_SWAP;
const icp_ledger_canister_id = "nppha-riaaa-aaaal-ajf2q-cai";
const tokenomics_canister_id = process.env.CANISTER_ID_TOKENOMICS;
const user_canister_id = process.env.CANISTER_ID_USER;
const log_canister_id = process.env.CANISTER_ID_LOGS;
const icp_swap_factory_canister_id = "ggzvv-5qaaa-aaaag-qck7a-cai";
const lbry_fun_canister_id = process.env.CANISTER_ID_LBRY_FUN;
export const getPrincipal = (client) => client.getIdentity().getPrincipal().toString();
export const getAuthClient = async () => {
    // create new client each time inspired by default react app
    // https://gitlab.com/kurdy/dfx_base/-/blob/main/src/dfx_base_frontend/src/services/auth.ts?ref_type=heads
    // reason for creating new client each time is
    // if the user login has expired it will SPA will not know
    // as same client's ( isAuthenticated ) will always return true even if user session is expired
    const authClient = await AuthClient.create();
    return authClient;
};
const getActor = async (canisterId, createActorFn, defaultActor) => {
    try {
        const client = await getAuthClient();
        if (await client.isAuthenticated()) {
            const identity = client.getIdentity();
            const agent = await HttpAgent.create({
                identity,
                host: isLocalDevelopment
                    ? `http://${process.env.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943` // Local development URL
                    : "https://identity.ic0.app", // Default to mainnet if neither condition is true
            });
            // Fetch root key for certificate validation during development
            // dangerous on mainnet
            if (isLocalDevelopment) {
                await agent.fetchRootKey().catch((err) => {
                    console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
                    console.error(err);
                });
            }
            return createActorFn(canisterId, {
                agent,
            });
        }
    }
    catch (error) {
        console.error(`Error initializing actor for ${canisterId}:`, error);
    }
    return defaultActor;
};
export const getActorSwap = (canisterId) => getActor(canisterId, createActorSwap, icp_swap);
export const getIcpLedgerActor = () => getActor(icp_ledger_canister_id, createActorIcpLedger, icp_ledger_canister);
export const getTokenomicsActor = (canisterId) => getActor(canisterId, createActorTokenomics, tokenomics);
export const getICRCActor = (canisterId) => getActor(canisterId, createActorICRC, ICRC);
export const getLogs = () => getActor(log_canister_id, createActorLogs, logs);
export const getLbryFunActor = () => getActor(lbry_fun_canister_id, createActorLbryFun, lbry_fun);
export const getIcpSwapFactoryCanister = () => getActor(icp_swap_factory_canister_id, createActorIcpSwapFactory, icp_swap_factory);
