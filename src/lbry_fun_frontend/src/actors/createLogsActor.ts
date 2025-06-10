import { Actor, HttpAgent, ActorSubclass } from '@dfinity/agent';
import { idlFactory as logsIdlFactory } from '../../../declarations/logs/logs.did.js';
import { _SERVICE as LogsService } from '../../../declarations/logs/logs.did';

export const createLogsActor = (canisterId: string): ActorSubclass<LogsService> => {
  const agent = new HttpAgent({
    host:
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:4943'
        : 'https://icp-api.io',
  });

  if (process.env.NODE_ENV === 'development') {
    agent.fetchRootKey();
  }

  return Actor.createActor<LogsService>(logsIdlFactory, {
    agent,
    canisterId,
  });
}; 