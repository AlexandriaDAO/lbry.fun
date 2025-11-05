import { createActorHook } from "ic-use-actor";
import { _SERVICE } from "../../../../declarations/icp_swap/icp_swap.did";
import { idlFactory } from "../../../../declarations/icp_swap/icp_swap.did.js";
import { getIcHost } from "@/utils/getIcHost";

const useIcpSwap = createActorHook<_SERVICE>({
  canisterId: process.env.CANISTER_ID_ICP_SWAP!,
  idlFactory: idlFactory,
  httpAgentOptions: { host: getIcHost() },
});

export default useIcpSwap;
