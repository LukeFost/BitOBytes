import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getBackendActor, Video } from '@/utils/canisterUtils';

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="container">
      <Head>
        <title>BitOBytes - Decentralized Video Platform</title>
        <meta name="description" content="Decentralized TikTok-like platform on the Internet Computer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="header">
        <h1 className="text-3xl font-bold">BitOBytes</h1>
      </header>

      <main className="py-8">
        <div className="flex flex-col items-center justify-center mb-8">
          <button 
            className="button"
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
            <div>
              {videos.map((video) => (
                <div key={video.id.toString()} className="video-item">
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
  );
}
