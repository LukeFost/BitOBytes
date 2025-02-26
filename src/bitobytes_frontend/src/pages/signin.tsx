import React from 'react';
import Head from 'next/head';
import LoginPage from '../components/login/LoginPage';
import dynamic from 'next/dynamic';

// Create a client-side only component
const SignInComponent = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Sign In - BitOBytes</title>
        <meta name="description" content="Sign in to BitOBytes with Ethereum" />
      </Head>

      <main>
        <LoginPage />
      </main>
    </div>
  );
};

// Export a dynamic version that only runs on the client
export default dynamic(() => Promise.resolve(SignInComponent), { ssr: false });
