import { createUseActorHook } from "ic-use-actor";
import { _SERVICE } from "../../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { idlFactory } from "../../../../declarations/icp_ledger_canister/icp_ledger_canister.did.js";
import { getIcHost } from "@/utils/getIcHost";

const useIcpLedger = createUseActorHook<_SERVICE>({
  canisterId: process.env.CANISTER_ID_ICP_LEDGER_CANISTER || "ryjl3-tyaaa-aaaaa-aaaba-cai",
  idlFactory: idlFactory,
  httpAgentOptions: { host: getIcHost() },
});

export default useIcpLedger;
