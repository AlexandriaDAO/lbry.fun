import React, { createContext, useContext, useEffect, useState } from "react";
import { ActorProvider, createActorContext } from "ic-use-actor";
import { idlFactory } from "../../../ICRC";
import { _SERVICE } from "../../../ICRC/ICRC.did";
import { ReactNode } from "react";
import { useIdentity } from "@/hooks/useIdentity";
import { useActorErrorHandler } from "@/hooks/actors";
import { AnonymousIdentity } from "@dfinity/agent";

// Create a context for dynamic ICRC actors
export const ICRCActorContext = createContext<{
    createICRCActor: (canisterId: string) => any;
}>({
    createICRCActor: () => null,
});

// Hook to use ICRC actors
export const useICRCActor = (canisterId: string) => {
    const context = useContext(ICRCActorContext);
    if (!context) {
        throw new Error('useICRCActor must be used within ICRCActorProvider');
    }
    return context.createICRCActor(canisterId);
};

// Provider component
export default function ICRCActorProvider({ children }: { children: ReactNode }) {
    const { identity, clear, isInitializing, isLoggingIn } = useIdentity();
    const { errorToast, handleRequest, handleResponse, handleResponseError } = useActorErrorHandler(clear);
    const [actors, setActors] = useState<Map<string, any>>(new Map());

    const createICRCActor = (canisterId: string) => {
        if (!canisterId) return null;
        
        // Return cached actor if exists
        if (actors.has(canisterId)) {
            return actors.get(canisterId);
        }

        // For now, we'll need to handle dynamic actor creation differently
        // This is a placeholder that will need refinement
        return null;
    };

    if (isInitializing || isLoggingIn) return <>{children}</>;

    return (
        <ICRCActorContext.Provider value={{ createICRCActor }}>
            {children}
        </ICRCActorContext.Provider>
    );
}