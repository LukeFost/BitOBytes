import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getBackendActor, Video } from '../utils/canisterUtils';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import { getIpfsUrl } from '../utils/ipfs';
import dynamic from 'next/dynamic';

// Create a client-side only component
const HomeComponent = () => {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Format view count
  const formatViews = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toString();
    }
  };
  
  // Format the timestamp to a readable date
  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000); // Convert nanoseconds to milliseconds
    return date.toLocaleDateString();
  };
  
  // Navigate to video detail page
  const navigateToVideo = (videoId: bigint) => {
    router.push(`/video/${videoId.toString()}`);
  };

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);

    try {
      const backendActor = await getBackendActor();
      const fetchedVideos = await backendActor.getVideos();
      console.log('Fetched videos:', fetchedVideos);
      
      // Log more detailed information about each video
      fetchedVideos.forEach((video, index) => {
        console.log(`Video ${index}:`, {
          id: video.id.toString(),
          title: video.title,
          mediaRef: video.mediaRef,
          thumbnailCid: video.thumbnailCid,
          hlsCid: video.hlsCid,
          duration: video.duration.toString(),
          likes: video.likes.toString(),
          views: video.views.toString(),
          timestamp: video.timestamp.toString()
        });
      });
      
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
                  <div 
                    key={video.id.toString()} 
                    className="video-item bg-white shadow-md rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigateToVideo(video.id)}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-200">
                      {video.thumbnailCid ? (
                        <img 
                          src={getIpfsUrl(video.thumbnailCid)}
                          alt={video.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-thumbnail.jpg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-300">
                          <span className="text-gray-600">No Thumbnail</span>
                        </div>
                      )}
                      
                      {/* Duration badge */}
                      {video.duration > 0 && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
                          {formatDuration(Number(video.duration))}
                        </div>
                      )}
                    </div>
                    
                    {/* Video info */}
                    <div className="p-4">
                      <h3 className="text-lg font-medium line-clamp-2">{video.title}</h3>
                      <div className="flex justify-between mt-2">
                        <p className="text-sm text-gray-500">
                          {video.views ? formatViews(Number(video.views)) : '0'} views
                        </p>
                        <p className="text-sm text-gray-500 flex items-center">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-4 w-4 mr-1" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                          >
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                          </svg>
                          {video.likes.toString()}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Uploaded on {formatDate(video.timestamp)}
                      </p>
                    </div>
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
