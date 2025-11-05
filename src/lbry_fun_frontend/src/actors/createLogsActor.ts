import { Actor, HttpAgent, ActorSubclass } from '@dfinity/agent';
import { idlFactory as logsIdlFactory } from '../../../declarations/logs/logs.did.js';
import { _SERVICE as LogsService } from '../../../declarations/logs/logs.did';
import { getIcHost } from '@/utils/getIcHost';

export const createLogsActor = async (canisterId: string): Promise<ActorSubclass<LogsService>> => {
  const agent = new HttpAgent({
    host: getIcHost()
  });

  // Critical for local development - must await and handle errors
  if (process.env.DFX_NETWORK !== "ic") {
    try {
      await agent.fetchRootKey();
    } catch (err) {
      console.warn("Unable to fetch root key. This is expected in production.", err);
    }
  }

  return Actor.createActor<LogsService>(logsIdlFactory, {
    agent,
    canisterId,
  });
}; 