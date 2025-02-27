// src/bitobytes_frontend/src/pages/upload.tsx

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';

// Use dynamic import with no SSR for the upload form
const VideoUploadForm = dynamic(() => import('../components/VideoUploadForm'), { ssr: false });

const UploadPage: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // Handle upload success
  const handleUploadSuccess = (videoId: bigint) => {
    setUploadSuccess(true);
    setUploadError('');
    
    // Automatically redirect to home page after a delay
    setTimeout(() => {
      router.push('/');
    }, 3000);
  };
  
  // Handle upload error
  const handleUploadError = (error: string) => {
    setUploadError(error);
    setUploadSuccess(false);
  };
  
  return (
    <div>
      <Head>
        <title>Upload Video - BitOBytes</title>
        <meta name="description" content="Upload videos to BitOBytes" />
      </Head>
      
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Upload Video</h1>
        
        {isLoading ? (
          <div className="text-center py-8">
            <p>Loading...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <p>You need to sign in to upload videos.</p>
            <button
              onClick={() => router.push('/signin')}
              className="mt-2 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Sign In
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {uploadSuccess ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p>Video uploaded successfully! Redirecting to home page...</p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-gray-700">
                  Upload your videos to BitOBytes. Your videos will be stored on IPFS via our
                  local Helia node and will be available to viewers instantly.
                </p>
                
                <VideoUploadForm
                  onSuccess={handleUploadSuccess}
                  onError={handleUploadError}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Use dynamic import with no SSR for the entire page
export default dynamic(() => Promise.resolve(UploadPage), { ssr: false });