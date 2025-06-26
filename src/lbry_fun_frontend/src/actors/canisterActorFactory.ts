import { Actor, HttpAgent, ActorSubclass } from '@dfinity/agent';
import { idlFactory as icpSwapIdlFactory } from '../../../declarations/icp_swap/icp_swap.did.js';
import { idlFactory as tokenomicsIdlFactory } from '../../../declarations/tokenomics/tokenomics.did.js';
import { _SERVICE as IcpSwapService } from '../../../declarations/icp_swap/icp_swap.did';
import { _SERVICE as TokenomicsService } from '../../../declarations/tokenomics/tokenomics.did';

export type CanisterType = 'icp_swap' | 'tokenomics';
export type CanisterService<T extends CanisterType> = T extends 'icp_swap' ? IcpSwapService : TokenomicsService;

export const createCanisterActor = async <T extends CanisterType>(
  canisterId: string, 
  canisterType: T
): Promise<ActorSubclass<CanisterService<T>>> => {
  const agent = new HttpAgent({
    host: process.env.DFX_NETWORK === "ic" ? "https://ic0.app" : "http://localhost:4943"
  });

  // Fetch root key for local development
  if (process.env.DFX_NETWORK !== "ic") {
    await agent.fetchRootKey();
  }

  const idlFactory = canisterType === 'icp_swap' ? icpSwapIdlFactory : tokenomicsIdlFactory;
  
  return Actor.createActor(idlFactory, {
    agent,
    canisterId,
  }) as ActorSubclass<CanisterService<T>>;
};