import React, { useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useSiwe } from 'ic-siwe-js/react';
import { isChainIdSupported } from '../../wagmi/is-chain-id-supported';

const LoginButton: React.FC = () => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { 
    login, 
    isLoggingIn, 
    isPreparingLogin, 
    loginError,
    prepareLoginStatus,
    loginStatus,
    identity,
    delegationChain
  } = useSiwe();

  // Log errors for debugging
  useEffect(() => {
    if (loginError) {
      console.error('Login error:', loginError);
      console.error('Login error stack:', loginError.stack);
    }
  }, [loginError]);

  // Log SIWE state for debugging
  useEffect(() => {
    console.log('SIWE State:', { 
      isConnected, 
      chainId,
      isLoggingIn,
      isPreparingLogin,
      prepareLoginStatus,
      loginStatus,
      hasIdentity: !!identity,
      hasDelegationChain: !!delegationChain
    });
  }, [isConnected, chainId, isLoggingIn, isPreparingLogin, prepareLoginStatus, loginStatus, identity, delegationChain]);

  // Enhanced login function with more logging
  const handleLogin = async () => {
    try {
      console.log('Starting login process...');
      console.log('Current chain ID:', chainId);
      console.log('Is chain supported:', isChainIdSupported(chainId));
      console.log('Is connected:', isConnected);
      console.log('Prepare login status:', prepareLoginStatus);
      console.log('Login status:', loginStatus);
      
      // Call the login function
      console.log('Calling login function...');
      await login();
      console.log('Login function completed');
    } catch (error) {
      console.error('Login function threw an error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  };

  // Button text based on state
  const text = () => {
    if (isLoggingIn) {
      return "Signing in";
    }
    if (isPreparingLogin) {
      return "Preparing";
    }
    return "Sign Wallet";
  };

  // Determine button state
  const disabled =
    !isChainIdSupported(chainId) ||
    isLoggingIn ||
    !isConnected ||
    isPreparingLogin;

  return (
    <div className="w-full">
      <button
        onClick={handleLogin}
        disabled={disabled}
        className="w-full py-3 px-4 bg-white border-2 border-gray-800 hover:bg-gray-100 text-gray-900 font-medium rounded-md text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {text()}
      </button>

      {loginError && (
        <div className="mt-2 text-red-600 text-sm">
          Error: {loginError.message}
        </div>
      )}

      {!isChainIdSupported(chainId) && (
        <div className="mt-2 text-yellow-600 text-sm">
          Please switch to a supported network to sign in.
        </div>
      )}
    </div>
  );
};

export default LoginButton;
