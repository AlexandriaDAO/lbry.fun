import React, { ReactNode } from 'react';
import { LbryFunActor } from '@/actors';

interface ActorProviderProps {
  children: ReactNode;
}

export default function ActorProvider({ children }: ActorProviderProps) {
  // Compose actors as per the readme pattern
  return (
    <LbryFunActor>
      {children}
    </LbryFunActor>
  );
}