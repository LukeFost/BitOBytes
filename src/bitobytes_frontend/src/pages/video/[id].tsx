import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Navigation from '../../components/Navigation';
import VideoPlayer from '../../components/VideoPlayer';
import AddToQueueButton from '../../components/AddToQueueButton';
import VideoCard from '../../components/VideoCard';
import { getBackendActor, Video } from '../../utils/canisterUtils';
import { getIpfsUrl } from '../../utils/ipfs';

// Create a client-side only component
const VideoDetailComponent = () => {
  const router = useRouter();
  const { id } = router.query;
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [showQueueSuccess, setShowQueueSuccess] = useState(false);

  useEffect(() => {
    // Fetch the specific video and related videos when the ID is available
    const fetchData = async () => {
      if (!id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('Fetching video with ID:', id);
        const backendActor = await getBackendActor();
        
        // Convert ID string to bigint for the canister call
        let videoId: bigint;
        try {
          videoId = BigInt(id as string);
          console.log('Converted ID to BigInt:', videoId.toString());
          
          // Fetch the specific video
          console.log('Calling backend.getVideo with ID:', videoId.toString());
          const fetchedVideo = await backendActor.getVideo(videoId);
          console.log('Fetched video result:', fetchedVideo);
          
          if (!fetchedVideo) {
            console.error('Video not found for ID:', videoId.toString());
            setError('Video not found');
            setLoading(false);
            return;
          }
          
          // The backend should return a single Video object or null
          // If it's null, we've already handled that above
          // If it's an array (unexpected), extract the first item
          let videoData;
          if (Array.isArray(fetchedVideo)) {
            console.log('Warning: getVideo returned an array instead of a single object');
            if (fetchedVideo.length > 0) {
              videoData = fetchedVideo[0]; // Extract the single object from the array
            } else {
              console.error('Empty video array returned');
              setError('Video data is invalid');
              setLoading(false);
              return;
            }
          } else {
            videoData = fetchedVideo;
          }
          
          // Ensure videoData is a single object, not an array
          console.log('Setting video data:', videoData);
          setVideo(videoData); // This should now always be a single Video object
        } catch (error) {
          const idErr = error as Error;
          console.error('Error converting ID to BigInt:', idErr);
          setError(`Invalid video ID: ${id}. Error: ${idErr.message}`);
          setLoading(false);
          return;
        }
        
        // Increment view count
        try {
          await backendActor.incrementViewCount(videoId);
        } catch (viewErr) {
          console.error('Error incrementing view count:', viewErr);
          // Don't fail the whole page load for this
        }
        
        // Fetch all videos to show related videos
        const allVideos = await backendActor.getVideos();
        
        // Filter out the current video and limit to 5 related videos
        const related = allVideos
          .filter(v => v.id.toString() !== id)
          .slice(0, 5);
        
        setRelatedVideos(related);
      } catch (err) {
        console.error('Error fetching video:', err);
        setError('Failed to load video. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  // Handle video like
  const handleLike = async () => {
    if (!video) return;
    
    try {
      // Refresh the video data to get updated like count
      const backendActor = await getBackendActor();
      const updatedVideo = await backendActor.getVideo(video.id);
      
      if (updatedVideo) {
        // Handle case where updatedVideo is an array (same fix as above)
        if (Array.isArray(updatedVideo) && updatedVideo.length > 0) {
          setVideo(updatedVideo[0]); // Extract the single object from the array
        } else if (!Array.isArray(updatedVideo)) {
          setVideo(updatedVideo);
        }
      }
    } catch (err) {
      console.error('Error refreshing video data after like:', err);
    }
  };
  
  // Format the timestamp to a readable date
  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000); // Convert nanoseconds to milliseconds
    return date.toLocaleString();
  };

  // Handle queue success
  const handleQueueSuccess = () => {
    setShowQueueSuccess(true);
    
    // Hide the success message after 3 seconds
    setTimeout(() => {
      setShowQueueSuccess(false);
    }, 3000);
  };

  return (
    <div>
      <Head>
        <title>{video ? `${video.title} - BitOBytes` : 'Loading Video - BitOBytes'}</title>
        <meta name="description" content={video ? `Watch ${video.title} on BitOBytes` : 'Watch videos on BitOBytes'} />
      </Head>

      <Navigation />

      <div className="container mx-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        ) : video ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main video container - takes 2/3 of the screen on large displays */}
            <div className="lg:col-span-2">
              <VideoPlayer 
                videoId={video.id}
                title={video.title}
                mediaRef={video.mediaRef}
                thumbnailCid={video.thumbnailCid}
                hlsCid={video.hlsCid}
                duration={Number(video.duration)}
                likes={Number(video.likes)}
                views={Number(video.views)}
                onLike={handleLike}
              />

              {/* Video metadata */}
              <div className="mt-4 bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold">{video.title}</h2>
                    <p className="text-gray-600 text-sm">
                      Uploaded on {video.timestamp ? formatDate(video.timestamp) : 'Unknown date'}
                    </p>
                  </div>
                  
                  {/* Add to Queue button */}
                  <div className="flex items-center">
                    <AddToQueueButton 
                      videoId={video.id} 
                      className="h-10 w-10 p-2"
                      onSuccess={handleQueueSuccess}
                    />
                    <span className="ml-2 text-sm">Add to Queue</span>
                    
                    {/* Success message */}
                    {showQueueSuccess && (
                      <div className="ml-4 text-green-600 text-sm font-medium animate-pulse">
                        Added to your queue!
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-semibold">About this video</h3>
                  <p className="mt-2 text-gray-700">
                    This video was uploaded to the Internet Computer and is stored on IPFS.
                  </p>
                  
                  <div className="mt-4 bg-gray-100 p-2 rounded text-xs font-mono overflow-auto">
                    <p>Video ID: {video.id ? video.id.toString() : 'N/A'}</p>
                    <p>Media CID: {video.mediaRef || 'N/A'}</p>
                    {video.hlsCid && <p>HLS CID: {video.hlsCid}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Related videos sidebar - takes 1/3 of the screen on large displays */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Related Videos</h3>
              
              {relatedVideos.length === 0 ? (
                <p className="text-gray-500">No related videos found.</p>
              ) : (
                <div className="space-y-4">
                  {relatedVideos.map((relatedVideo) => (
                    <VideoCard 
                      key={relatedVideo.id.toString()}
                      video={relatedVideo}
                      compact={true}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            No video ID specified. Please select a video to watch.
          </div>
        )}
      </div>
    </div>
  );
};

// Export a dynamic version that only runs on the client
export default dynamic(() => Promise.resolve(VideoDetailComponent), { ssr: false });
