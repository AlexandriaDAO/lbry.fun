import React, { useCallback, useEffect, useMemo } from "react";
import { type DelegationIdentity, isDelegationValid } from "@dfinity/identity";
import {
  authenticateAll,
  ensureAllInitialized,
  type InterceptorErrorData,
  type InterceptorRequestData,
  type InterceptorResponseData,
} from "ic-use-actor";

import { getIdentity, useIdentity } from "@/hooks/useIdentity";
import { toast } from "sonner";
import {
  useLbryFun,
  useIcpLedger,
  useIcpSwap,
  useTokenomics,
} from "@/hooks/actors";

export default function ActorProvider() {
  const { identity, clear } = useIdentity();

  // Initialize actor hooks
  const lbryFun = useLbryFun();
  const icpLedger = useIcpLedger();
  const icpSwap = useIcpSwap();
  const tokenomics = useTokenomics();

  // Delegation validation interceptor
  const onRequest = useCallback(
    (data: InterceptorRequestData) => {
      const id = getIdentity();
      console.log("[ActorProvider] onRequest", data.methodName, data.args);

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

  const interceptors = useMemo(
    () => ({
      onRequest,
      onResponse,
      onRequestError,
      onResponseError,
    }),
    [onRequest, onResponse, onRequestError, onResponseError]
  );

  // Re-authenticate all actors when identity changes
  useEffect(() => {
    if (!identity) return;

    console.log("[ActorProvider] Identity changed, authenticating all actors");
    ensureAllInitialized().then(() => {
      authenticateAll(identity);
    });
  }, [identity]);

  // Set interceptors on all actors
  useEffect(() => {
    console.log("[ActorProvider] Setting interceptors on all actors");
    ensureAllInitialized().then(() => {
      lbryFun.setInterceptors(interceptors);
      icpLedger.setInterceptors(interceptors);
      icpSwap.setInterceptors(interceptors);
      tokenomics.setInterceptors(interceptors);
    });
  }, [interceptors, lbryFun, icpLedger, icpSwap, tokenomics]);

  return null; // No UI, just side effects
}
