import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';

export const createActor = async (
  canisterId: string | Principal,
  idlFactory: IDL.InterfaceFactory
) => {
  const agent = new HttpAgent({
    host: process.env.DFX_NETWORK === 'ic' 
      ? 'https://ic0.app' 
      : 'http://localhost:4943',
  });

  // Fetch root key for local development
  if (process.env.DFX_NETWORK !== 'ic') {
    await agent.fetchRootKey();
  }

  const canisterPrincipal = typeof canisterId === 'string' 
    ? Principal.fromText(canisterId) 
    : canisterId;

  return Actor.createActor(idlFactory, {
    agent,
    canisterId: canisterPrincipal,
  });
};