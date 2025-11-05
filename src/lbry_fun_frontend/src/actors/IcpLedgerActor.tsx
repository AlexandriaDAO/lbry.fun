import React from "react";
import { ActorProvider } from "ic-use-actor";
import { canisterId, idlFactory } from "../../../declarations/icp_ledger_canister";
import { _SERVICE } from "../../../declarations/icp_ledger_canister/icp_ledger_canister.did";
import { ReactNode } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { IcpLedgerContext } from "@/contexts/actors";
import { useActorErrorHandler } from "@/hooks/actors";
import { AnonymousIdentity } from "@dfinity/agent";
import { getIcHost } from "@/utils/getIcHost";

export default function IcpLedgerActor({ children }: { children: ReactNode }) {
    const { identity, clear, isInitializing, isLoggingIn } = useIdentity();
    const { errorToast, handleRequest, handleResponse, handleResponseError } = useActorErrorHandler(clear);

    // Don't render the ActorProvider until we know the identity state
    if (isInitializing || isLoggingIn) return <>{children}</>;

    return (
        <ActorProvider<_SERVICE>
            canisterId={canisterId || "ryjl3-tyaaa-aaaaa-aaaba-cai"}
            context={IcpLedgerContext}
            identity={identity || new AnonymousIdentity()}
            idlFactory={idlFactory}
            httpAgentOptions={{ host: getIcHost() }}
            onRequest={handleRequest}
            onRequestError={(error) => errorToast(error)}
            onResponse={handleResponse}
            onResponseError={handleResponseError}
        >
            {children}
        </ActorProvider>
    );
}