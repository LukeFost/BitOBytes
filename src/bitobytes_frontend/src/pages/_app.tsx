import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../context/index';
import { canisterId } from '../../../ic_siwe_provider/declarations/index';
import { patchFetch } from '../utils/rootKeyFetch';
import { useEffect } from 'react';

// Configure global settings for ic-js
if (typeof window !== 'undefined') {
  // Set up environment variables in the browser
  window.process = {
    ...window.process,
    env: {
      ...window.process?.env,
      NEXT_PUBLIC_SIWE_CANISTER_ID: process.env.NEXT_PUBLIC_SIWE_CANISTER_ID,
      NEXT_PUBLIC_BACKEND_CANISTER_ID: process.env.NEXT_PUBLIC_BACKEND_CANISTER_ID,
      NEXT_PUBLIC_FRONTEND_CANISTER_ID: process.env.NEXT_PUBLIC_FRONTEND_CANISTER_ID,
      NEXT_PUBLIC_IC_HOST: process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943',
    }
  };
  
  // Enable debug logging for ic-siwe-js
  localStorage.setItem('debug', 'ic-siwe-js:*');
}

export default function App({ Component, pageProps }: AppProps) {
  // Use environment variable directly as fallback to ensure consistency
  const siweCanisterId = canisterId || process.env.NEXT_PUBLIC_SIWE_CANISTER_ID || '';
  
  // Apply the fetch patch to ensure root key is fetched, but only on the client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      patchFetch();
    }
  }, []);
  
  if (!siweCanisterId) {
    console.error("WARNING: No SIWE canister ID available. Authentication will not work.");
    console.error("Please run ./deploy-rust-siwe.sh to deploy the SIWE provider and set the environment variable.");
  }
  
  return (
    <AuthProvider canisterId={siweCanisterId}>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
