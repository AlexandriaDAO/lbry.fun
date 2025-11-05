import { createActorHook } from "ic-use-actor";
import { _SERVICE } from "../../../../declarations/lbry_fun/lbry_fun.did";
import { idlFactory } from "../../../../declarations/lbry_fun/lbry_fun.did.js";
import { getIcHost } from "@/utils/getIcHost";

const useLbryFun = createActorHook<_SERVICE>({
  canisterId: process.env.CANISTER_ID_LBRY_FUN!,
  idlFactory: idlFactory,
  httpAgentOptions: { host: getIcHost() },
});

export default useLbryFun;
