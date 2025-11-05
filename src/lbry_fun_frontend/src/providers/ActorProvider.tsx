import React, { ReactNode, useCallback } from "react";
import { type DelegationIdentity, isDelegationValid } from "@dfinity/identity";
import {
  ActorProvider as IcUseActorProvider,
  type InterceptorErrorData,
  type InterceptorRequestData,
  type InterceptorResponseData,
} from "ic-use-actor";

import { getIdentity, useIdentity } from "@/hooks/useIdentity";
import { toast } from "sonner";
import {
  LbryFunContext,
  IcpLedgerContext,
  IcpSwapContext,
  TokenomicsContext,
} from "@/contexts/actors";
import { idlFactory as lbryFunIdlFactory } from "../../../declarations/lbry_fun/lbry_fun.did.js";
import { idlFactory as icpLedgerIdlFactory } from "../../../declarations/icp_ledger_canister/icp_ledger_canister.did.js";
import { idlFactory as icpSwapIdlFactory } from "../../../declarations/icp_swap/icp_swap.did.js";
import { idlFactory as tokenomicsIdlFactory } from "../../../declarations/tokenomics/tokenomics.did.js";
import { getIcHost } from "@/utils/getIcHost";

interface ActorProviderProps {
  children: ReactNode;
}

export default function ActorProvider({ children }: ActorProviderProps) {
  const { identity, clear } = useIdentity();

  // Delegation validation interceptor
  const onRequest = useCallback(
    (data: InterceptorRequestData) => {
      const id = getIdentity();
      console.log("[ActorProvider] onRequest", data.methodName);

      if (
        id &&
        !isDelegationValid(
          (id as DelegationIdentity).getDelegation()
        )
      ) {
        toast.error("Login expired. Please sign in again.", {
          id: "login-expired",
          position: "bottom-right",
        });
        setTimeout(() => {
          clear(); // Clear identity
          window.location.reload(); // Reset UI
        }, 1000);
      }
      return data.args;
    },
    [clear]
  );

  const onRequestError = useCallback((data: InterceptorErrorData) => {
    console.error("[ActorProvider] onRequestError", data.methodName, data.error);
    return data.error;
  }, []);

  const onResponse = useCallback((data: InterceptorResponseData) => {
    console.log("[ActorProvider] onResponse", data.methodName);
    return data.response;
  }, []);

  const onResponseError = useCallback((data: InterceptorErrorData) => {
    console.error("[ActorProvider] onResponseError", data.methodName, data.error);
    return data.error;
  }, []);

  const httpAgentOptions = { host: getIcHost() };

  return (
    <IcUseActorProvider
      canisterId={process.env.CANISTER_ID_LBRY_FUN!}
      context={LbryFunContext}
      identity={identity}
      idlFactory={lbryFunIdlFactory}
      httpAgentOptions={httpAgentOptions}
      onRequest={onRequest}
      onResponse={onResponse}
      onRequestError={onRequestError}
      onResponseError={onResponseError}
    >
      <IcUseActorProvider
        canisterId={process.env.CANISTER_ID_ICP_LEDGER_CANISTER || "ryjl3-tyaaa-aaaaa-aaaba-cai"}
        context={IcpLedgerContext}
        identity={identity}
        idlFactory={icpLedgerIdlFactory}
        httpAgentOptions={httpAgentOptions}
        onRequest={onRequest}
        onResponse={onResponse}
        onRequestError={onRequestError}
        onResponseError={onResponseError}
      >
        <IcUseActorProvider
          canisterId={process.env.CANISTER_ID_ICP_SWAP!}
          context={IcpSwapContext}
          identity={identity}
          idlFactory={icpSwapIdlFactory}
          httpAgentOptions={httpAgentOptions}
          onRequest={onRequest}
          onResponse={onResponse}
          onRequestError={onRequestError}
          onResponseError={onResponseError}
        >
          <IcUseActorProvider
            canisterId={process.env.CANISTER_ID_TOKENOMICS!}
            context={TokenomicsContext}
            identity={identity}
            idlFactory={tokenomicsIdlFactory}
            httpAgentOptions={httpAgentOptions}
            onRequest={onRequest}
            onResponse={onResponse}
            onRequestError={onRequestError}
            onResponseError={onResponseError}
          >
            {children}
          </IcUseActorProvider>
        </IcUseActorProvider>
      </IcUseActorProvider>
    </IcUseActorProvider>
  );
}
