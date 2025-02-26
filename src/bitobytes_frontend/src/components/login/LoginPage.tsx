import React, { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import ConnectButton from './ConnectButton';
import LoginButton from './LoginButton';

const LoginPage: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { signMessageAsync, isPending, error } = useSignMessage();
  const [testSignResult, setTestSignResult] = useState<string | null>(null);
  const [testSignError, setTestSignError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('');

  // Update connection status when isConnected changes
  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('Connected to wallet');
    } else {
      setConnectionStatus('');
    }
  }, [isConnected]);

  // Function to test signing a message
  const handleTestSign = async () => {
    if (!isConnected || !address) {
      setTestSignError('Please connect your wallet first');
      return;
    }

    setTestSignResult(null);
    setTestSignError(null);

    try {
      // Create a test message with timestamp to make it unique
      const message = `Test signing with address ${address} at ${new Date().toISOString()}`;
      
      // Sign the message
      const signature = await signMessageAsync({ message });
      
      // Display the result
      setTestSignResult(`Message signed successfully! Signature: ${signature.slice(0, 20)}...`);
    } catch (err) {
      console.error('Test sign error:', err);
      setTestSignError(`Failed to sign message: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
      <h1 className="text-3xl font-bold mb-10 text-center">Sign in with Ethereum</h1>
      
      {connectionStatus && (
        <div className="mb-6 text-green-600 font-medium">
          {connectionStatus}
        </div>
      )}
      
      <div className="w-full max-w-md flex flex-col items-center space-y-6">
        {/* Connect Wallet Button - Always visible */}
        <div className="w-full max-w-xs">
          <ConnectButton />
        </div>

        {/* Sign In Button - Always visible but may be disabled */}
        <div className="w-full max-w-xs">
          <LoginButton />
        </div>

        {/* Test Sign Button - Always visible but may be disabled */}
        <div className="w-full max-w-xs">
          <button
            onClick={handleTestSign}
            disabled={!isConnected || isPending}
            className="w-full py-3 px-4 bg-white border-2 border-gray-800 hover:bg-gray-100 text-gray-900 font-medium rounded-md text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Signing...' : 'Test Sign'}
          </button>
        </div>
        
        {/* Results and Errors */}
        {testSignResult && (
          <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md w-full max-w-xs">
            {testSignResult}
          </div>
        )}
        
        {(testSignError || error) && (
          <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md w-full max-w-xs">
            {testSignError || error?.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
