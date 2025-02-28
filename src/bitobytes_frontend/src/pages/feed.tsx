import React, { useState, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRecommendedFeed } from '../hooks/useUserQueueFeed';
import { useSiwe } from 'ic-siwe-js/react';
import Navigation from '../components/Navigation';
import AuthGuard from '../AuthGuard';
import VideoFeed from '../components/VideoFeed';
import AddToQueueButton from '../components/AddToQueueButton';
import Link from 'next/link';

const FeedPage: React.FC = () => {
  const { identity } = useSiwe();
  const userPrincipal = identity?.getPrincipal().toString() || '';
  const [showNav, setShowNav] = useState(true);
  const [currentVideoId, setCurrentVideoId] = useState<bigint | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useRecommendedFeed(userPrincipal);

  // Flatten all pages of videos
  const allVideos = data?.pages.flatMap((page) => page.videos) || [];

  const toggleNav = () => {
    setShowNav(!showNav);
  };

  // Update current video ID whenever VideoFeed updates the currently visible video
  const handleVideoVisible = (index: number) => {
    if (allVideos[index]) {
      setCurrentVideoId(allVideos[index].id);
    }
  };

  // Handle share button click
  const handleShare = () => {
    if (!currentVideoId) return;
    
    const url = `${window.location.origin}/video/${currentVideoId.toString()}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Check out this video on BitOBytes',
        text: 'I found this cool video!',
        url,
      }).catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback for browsers that don't support the Web Share API
      navigator.clipboard.writeText(url)
        .then(() => alert('Video link copied to clipboard!'))
        .catch(err => console.error('Could not copy link:', err));
    }
  };

  if (status === 'pending' || status === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          <p className="mt-4">Loading videos...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-center text-white bg-red-600 p-4 rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-2">Error Loading Feed</h2>
          <p>{error instanceof Error ? error.message : String(error)}</p>
          <Link href="/" className="mt-4 inline-block bg-white text-red-600 px-4 py-2 rounded-md">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-black text-white">
        <Head>
          <title>Video Feed - BitOBytes</title>
          <meta name="description" content="Endless video feed on BitOBytes" />
        </Head>

        {/* Overlay navigation - toggle with a tap */}
        {showNav && (
          <div 
            className="fixed top-0 left-0 right-0 z-10 bg-gradient-to-b from-black to-transparent p-4"
            onClick={toggleNav}
          >
            <Navigation />
          </div>
        )}

        {/* Video Feed */}
        {allVideos.length === 0 ? (
          <div className="fixed inset-0 flex items-center justify-center">
            <div className="text-center p-6 bg-gray-900 rounded-lg">
              <p className="mb-4">No videos in your feed yet.</p>
              <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
                Explore Videos
              </Link>
            </div>
          </div>
        ) : (
          <div 
            className="fixed inset-0"
            onClick={toggleNav}
          >
            <VideoFeed
              videos={allVideos}
              fetchNextPage={fetchNextPage}
              hasNextPage={!!hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onVideoVisible={handleVideoVisible}
            />
          </div>
        )}

        {/* Floating action buttons */}
        <div className="fixed bottom-6 right-6 z-10 flex flex-col items-center space-y-4">
          {/* Add to Queue Button */}
          {currentVideoId && (
            <div className="add-to-queue-btn">
              <AddToQueueButton 
                videoId={currentVideoId} 
                className="h-12 w-12 p-3 shadow-lg"
                onSuccess={() => {
                  // Show a brief success toast
                  const toast = document.createElement('div');
                  toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg';
                  toast.textContent = 'Added to queue!';
                  document.body.appendChild(toast);
                  
                  // Remove the toast after 2 seconds
                  setTimeout(() => {
                    toast.remove();
                  }, 2000);
                }}
              />
            </div>
          )}
          
          {/* Share Button */}
          <button 
            onClick={handleShare}
            className="bg-white text-black p-3 rounded-full shadow-lg"
            disabled={!currentVideoId}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>
    </AuthGuard>
  );
};

export default dynamic(() => Promise.resolve(FeedPage), { ssr: false });