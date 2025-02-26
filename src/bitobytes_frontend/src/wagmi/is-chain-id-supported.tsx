import { wagmiChains } from './wagmi.config';

/**
 * Checks if a given chain ID is supported by the application
 * @param chainId The chain ID to check
 * @returns boolean indicating if the chain is supported
 */
export function isChainIdSupported(chainId: number): boolean {
  return wagmiChains.some((chain) => chain.id === chainId);
}
