import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getBackendActor, Video } from '../utils/canisterUtils';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import dynamic from 'next/dynamic';

// Create a client-side only component
const HomeComponent = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);

    try {
      const backendActor = await getBackendActor();
      const fetchedVideos = await backendActor.getVideos();
      console.log('Fetched videos:', fetchedVideos);
      setVideos(fetchedVideos);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to fetch videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Head>
        <title>BitOBytes - Decentralized Video Platform</title>
        <meta name="description" content="Decentralized TikTok-like platform on the Internet Computer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation />

      <div className="container mx-auto px-4">
        <main className="py-8">
          <div className="flex flex-col items-center justify-center mb-8">
            <h1 className="text-3xl font-bold mb-6">BitOBytes</h1>
            
            {isAuthenticated ? (
              <p className="mb-4 text-green-600">You are signed in with Ethereum!</p>
            ) : (
              <p className="mb-4 text-gray-600">Sign in with Ethereum to access all features.</p>
            )}
            
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={fetchVideos}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Fetch Videos'}
            </button>

            {error && (
              <p className="text-red-500 mt-4">{error}</p>
            )}
          </div>

          <div className="video-list">
            <h2 className="text-xl font-semibold mb-4">Videos</h2>
            
            {videos.length === 0 ? (
              <p className="text-gray-500">No videos found. Videos will appear here after fetching.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((video) => (
                  <div key={video.id.toString()} className="video-item bg-white shadow-md rounded-lg p-4">
                    <h3 className="text-lg font-medium">{video.title}</h3>
                    <p className="text-sm text-gray-500">
                      ID: {video.id.toString()} | Likes: {video.likes.toString()}
                    </p>
                    <p className="text-sm">Media Reference: {video.mediaRef}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <footer className="mt-8 pt-8 border-t border-gray-200 text-center text-gray-500">
          <p>Powered by Internet Computer</p>
        </footer>
      </div>
    </div>
  );
};

// Export a dynamic version that only runs on the client
export default dynamic(() => Promise.resolve(HomeComponent), { ssr: false });
