import React from 'react';
import Head from 'next/head';
import { useAccount } from 'wagmi';
import { useSiwe } from 'ic-siwe-js/react';
import AuthGuard from '../AuthGuard';
import dynamic from 'next/dynamic';

// Create a client-side only component
const ProfileComponent = () => {
  const { address } = useAccount();
  const { identity, identityAddress } = useSiwe();

  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8">
        <Head>
          <title>Profile - BitOBytes</title>
          <meta name="description" content="Your BitOBytes profile" />
        </Head>

        <main>
          <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Ethereum Account</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">Connected Address:</p>
              <p className="font-mono bg-gray-100 p-2 rounded">{address}</p>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">Identity Address:</p>
              <p className="font-mono bg-gray-100 p-2 rounded">{identityAddress}</p>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">Internet Computer Identity:</p>
              <p className="font-mono bg-gray-100 p-2 rounded overflow-x-auto">
                {identity ? identity.getPrincipal().toString() : 'Not available'}
              </p>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
};

// Export a dynamic version that only runs on the client
export default dynamic(() => Promise.resolve(ProfileComponent), { ssr: false });
