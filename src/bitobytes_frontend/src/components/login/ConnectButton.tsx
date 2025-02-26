import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { isChainIdSupported } from '../../wagmi/is-chain-id-supported';

const ConnectButton: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, error, isPending: isLoading } = useConnect();
  const { disconnect } = useDisconnect();

  // Log available connectors on component mount
  useEffect(() => {
    console.log('Available connectors:', connectors.map(c => ({ name: c.name, ready: c.ready })));
  }, [connectors]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Specifically look for the injected connector (MetaMask)
      const injectedConnector = connectors.find(c => c.name === 'Injected');
      
      if (injectedConnector) {
        console.log('Connecting with MetaMask...');
        await connect({ connector: injectedConnector });
      } else {
        console.error('MetaMask connector not found');
        // Try any available connector as fallback
        const anyConnector = connectors.find(c => c.ready);
        if (anyConnector) {
          console.log('Connecting with fallback connector:', anyConnector.name);
          await connect({ connector: anyConnector });
        } else {
          console.error('No ready connectors found');
        }
      }
    } catch (err) {
      console.error('Connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // Check if the connected chain is supported
  const isUnsupportedChain = chainId ? !isChainIdSupported(chainId) : false;

  return (
    <div className="w-full">
      {!isConnected ? (
        <button
          onClick={handleConnect}
          disabled={isLoading || isConnecting}
          className="w-full py-3 px-4 bg-white border-2 border-gray-800 hover:bg-gray-100 text-gray-900 font-medium rounded-md text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading || isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="w-full">
          {isUnsupportedChain ? (
            <div className="text-red-600 text-sm font-medium mb-2">
              Unsupported network. Please switch to a supported network.
            </div>
          ) : (
            <div className="font-mono bg-gray-100 p-2 rounded-md text-center mb-2">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          )}
          <button 
            onClick={handleDisconnect} 
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md text-center transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
      {error && (
        <div className="mt-2 text-red-600 text-sm">
          {error.message}
        </div>
      )}
    </div>
  );
};

export default ConnectButton;
