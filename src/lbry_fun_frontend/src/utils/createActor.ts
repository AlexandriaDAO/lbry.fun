import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';
import { getIcHost } from './getIcHost';

export const createActor = async (
  canisterId: string | Principal,
  idlFactory: IDL.InterfaceFactory
) => {
  const agent = new HttpAgent({
    host: getIcHost(),
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