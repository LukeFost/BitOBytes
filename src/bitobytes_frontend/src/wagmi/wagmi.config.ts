import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// Create wagmi config with supported chains and connectors
export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected({
      shimDisconnect: true, // This helps with MetaMask disconnect issues
    }),
    walletConnect({
      // Using the provided projectId
      // In production, you should use an environment variable
      projectId: '3314f21eac8f71b9c7d0fd4b2ab0db7c',
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

// Export the configured chains for use in other components
export const wagmiChains = [mainnet, sepolia];
