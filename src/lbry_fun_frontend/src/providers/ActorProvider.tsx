import React, { ReactNode } from 'react';
import { LbryFunActor, IcpLedgerActor, ICRCActorProvider } from '@/actors';

interface ActorProviderProps {
  children: ReactNode;
}

export default function ActorProvider({ children }: ActorProviderProps) {
  // Compose actors as per the alex_frontend pattern
  return (
    <LbryFunActor>
      <IcpLedgerActor>
        <ICRCActorProvider>
          {children}
        </ICRCActorProvider>
      </IcpLedgerActor>
    </LbryFunActor>
  );
}