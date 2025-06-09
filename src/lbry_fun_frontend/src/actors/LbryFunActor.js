import React from "react";
import { ActorProvider } from "ic-use-actor";
import { canisterId, idlFactory } from "../../../declarations/lbry_fun";
import { useIdentity } from "@/hooks/useIdentity";
import { LbryFunContext } from "@/contexts/actors";
import { useActorErrorHandler } from "@/hooks/actors";
import { AnonymousIdentity } from "@dfinity/agent";
export default function Lbry_Fun_Actor({ children }) {
    const { identity, clear, isInitializing, isLoggingIn } = useIdentity();
    const { errorToast, handleRequest, handleResponse, handleResponseError } = useActorErrorHandler(clear);
    // Don't render the ActorProvider until we know the identity state
    if (isInitializing || isLoggingIn)
        return React.createElement(React.Fragment, null, children);
    return (React.createElement(ActorProvider, { canisterId: canisterId, context: LbryFunContext, identity: identity || new AnonymousIdentity(), idlFactory: idlFactory, onRequest: handleRequest, onRequestError: (error) => errorToast(error), onResponse: handleResponse, onResponseError: handleResponseError }, children));
}
