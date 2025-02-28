import React from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useMyQueueFeed } from '../hooks/useUserQueueFeed';
import { useSiwe } from 'ic-siwe-js/react';
import Navigation from '../components/Navigation';
import AuthGuard from '../AuthGuard';
import VideoCard from '../components/VideoCard';

const MyQueuePage: React.FC = () => {
  const { identity } = useSiwe();
  const userPrincipal = identity?.getPrincipal().toString() || '';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useMyQueueFeed(userPrincipal);

  // Flatten all pages of videos
  const allVideos = data?.pages.flatMap((page) => page.videos) || [];

  return (
    <AuthGuard>
      <>
        <Head>
          <title>My Queue - BitOBytes</title>
          <meta name="description" content="Your saved videos on BitOBytes" />
        </Head>

        <Navigation />

        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold mb-6">My Queue</h1>

          {(status === 'pending' || status === 'loading') && (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-2">Loading your queue...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              Error: {error instanceof Error ? error.message : String(error)}
            </div>
          )}

          {status === 'success' && allVideos.length === 0 && (
            <div className="text-center py-10">
              <p className="text-gray-500">Your queue is empty. Add videos to watch later!</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allVideos.map((video) => (
              <VideoCard key={video.id.toString()} video={video} />
            ))}
          </div>

          {hasNextPage && (
            <div className="text-center mt-6">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Loading more...' : 'Load More Videos'}
              </button>
            </div>
          )}
        </div>
      </>
    </AuthGuard>
  );
};

export default dynamic(() => Promise.resolve(MyQueuePage), { ssr: false });