import React, { ReactNode, useEffect, useState } from 'react';
import { SiweIdentityProvider, useSiwe } from 'ic-siwe-js/react';
import { WagmiProvider } from 'wagmi';
import { config } from '../wagmi/wagmi.config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from './AuthContext';
import dynamic from 'next/dynamic';

// Create a query client for React Query
const queryClient = new QueryClient();

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
  canisterId: string;
}

// Internal provider that uses the SIWE hooks
const InternalAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { 
    identity, 
    login: siweLogin, 
    clear, 
    isInitializing,
    loginStatus,
    prepareLoginStatus,
    isLoginSuccess,
    isLoginError,
    loginError,
    delegationChain
  } = useSiwe();

  // Derived authentication state
  const isAuthenticated = !!identity;
  const isLoading = isInitializing || loginStatus === 'logging-in';

  // Login function that wraps the SIWE login
  const login = async () => {
    try {
      console.log('Starting SIWE login process...');
      console.log('Current login status:', loginStatus);
      console.log('Current prepare login status:', prepareLoginStatus);
      console.log('Has identity:', !!identity);
      console.log('Has delegation chain:', !!delegationChain);
      
      // Call the SIWE login function
      await siweLogin();
      console.log('SIWE login function completed');
    } catch (error) {
      console.error('Login failed:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  };

  // Logout function
  const logout = () => {
    console.log('Logging out...');
    console.log('Current identity:', identity?.getPrincipal().toString());
    clear();
    console.log('Identity cleared');
  };

  // Log authentication state changes
  useEffect(() => {
    console.log('Auth state changed:', {
      isAuthenticated,
      isLoading,
      loginStatus,
      prepareLoginStatus,
      isLoginSuccess,
      isLoginError
    });
    
    if (isLoginSuccess) {
      console.log('Login successful');
      console.log('Identity principal:', identity?.getPrincipal().toString());
      console.log('Delegation chain expiration:', delegationChain?.delegations[0]?.delegation.expiration.toString());
    }
    
    if (isLoginError && loginError) {
      console.error('Login error:', loginError);
      console.error('Login error stack:', loginError.stack);
    }
  }, [isLoginSuccess, isLoginError, loginError, isAuthenticated, isLoading, loginStatus, prepareLoginStatus, identity, delegationChain]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Main provider component that wraps all the necessary providers
const AuthProviderComponent: React.FC<AuthProviderProps> = ({ children, canisterId }) => {
  const host = process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
  
  // Ensure canisterId is available and log it for debugging
  console.log('SIWE canister ID:', canisterId);
  console.log('IC host:', host);
  
  if (!canisterId) {
    console.warn('No canisterId provided to AuthProvider');
  }

  // Setup localStorage debug option for more detailed logging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('debug', 'ic-siwe-js:*');
    }
  }, []);

  // Log when the component mounts and unmounts
  useEffect(() => {
    console.log('AuthProvider mounted');
    return () => {
      console.log('AuthProvider unmounted');
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SiweIdentityProvider
          canisterId={canisterId}
          httpAgentOptions={{
            host,
            verifyQuerySignatures: false,
            fetchOptions: {
              credentials: 'omit',
            },
          }}
        >
          <InternalAuthProvider>
            {children}
          </InternalAuthProvider>
        </SiweIdentityProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

// Export a dynamic version of the AuthProvider that only runs on the client
export const AuthProvider = dynamic<AuthProviderProps>(
  () => Promise.resolve(AuthProviderComponent),
  { ssr: false }
);
