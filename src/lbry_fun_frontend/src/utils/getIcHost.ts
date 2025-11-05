/**
 * Determines the Internet Computer host URL based on the deployment environment.
 *
 * @returns The IC host URL to use for HTTP agent connections
 */
export function getIcHost(): string {
  const dfxNetwork = process.env.DFX_NETWORK;

  // For mainnet deployment, use IC0 gateway
  if (dfxNetwork === 'ic') {
    return 'https://ic0.app';
  }

  // For local development, use localhost with dfx port
  return 'http://localhost:4943';
}
