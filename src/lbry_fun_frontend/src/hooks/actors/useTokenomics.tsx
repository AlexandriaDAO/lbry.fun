import { createUseActorHook } from "ic-use-actor";
import { _SERVICE } from "../../../../declarations/tokenomics/tokenomics.did";
import { idlFactory } from "../../../../declarations/tokenomics/tokenomics.did.js";
import { getIcHost } from "@/utils/getIcHost";

const useTokenomics = createUseActorHook<_SERVICE>({
  canisterId: process.env.CANISTER_ID_TOKENOMICS!,
  idlFactory: idlFactory,
  httpAgentOptions: { host: getIcHost() },
});

export default useTokenomics;
