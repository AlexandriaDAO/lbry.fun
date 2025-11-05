import React from "react";
import { ActorProvider } from "ic-use-actor";
import { canisterId, idlFactory } from "../../../declarations/tokenomics";

import { _SERVICE } from "../../../declarations/tokenomics/tokenomics.did";

import { ReactNode } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { TokenomicsContext } from "@/contexts/actors";
import { useActorErrorHandler } from "@/hooks/actors";
import { AnonymousIdentity } from "@dfinity/agent";
import { getIcHost } from "@/utils/getIcHost";

export default function TokenomicsActor({ children }: { children: ReactNode }) {
    const { identity, clear, isInitializing, isLoggingIn } = useIdentity();
    const { errorToast, handleRequest , handleResponse, handleResponseError} = useActorErrorHandler(clear);

	// Don't render the ActorProvider until we know the identity state
    if (isInitializing || isLoggingIn) return <>{children}</>;

	return (
		<ActorProvider<_SERVICE>
			canisterId={canisterId}
			context={TokenomicsContext}
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

