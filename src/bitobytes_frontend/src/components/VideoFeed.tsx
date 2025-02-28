import React, { useRef, useState, useEffect } from 'react';
import { Video } from '../utils/canisterUtils';
import VideoPlayer from './VideoPlayer';
import { getHlsUrl, getIpfsUrl } from '../utils/ipfs';

interface VideoFeedProps {
  videos: Video[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onVideoVisible?: (index: number) => void;
}

const VideoFeed: React.FC<VideoFeedProps> = ({
  videos,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  onVideoVisible
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<HTMLDivElement[]>([]);

  // Update video refs when videos change
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, videos.length);
  }, [videos]);

  // Handle scrolling - find which video is most visible
  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const containerTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    // Find which video is most visible in the viewport
    let maxVisibleIndex = 0;
    let maxVisibleArea = 0;
    
    videoRefs.current.forEach((videoRef, index) => {
      if (!videoRef) return;
      
      const rect = videoRef.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Calculate how much of the video is visible
      const top = Math.max(rect.top, containerRect.top);
      const bottom = Math.min(rect.bottom, containerRect.bottom);
      const visibleHeight = Math.max(0, bottom - top);
      const visibleArea = visibleHeight / rect.height;
      
      if (visibleArea > maxVisibleArea) {
        maxVisibleArea = visibleArea;
        maxVisibleIndex = index;
      }
    });
    
    // Update current index if it changed
    if (maxVisibleIndex !== currentIndex) {
      setCurrentIndex(maxVisibleIndex);
      
      // Notify parent component about the visible video change
      if (onVideoVisible) {
        onVideoVisible(maxVisibleIndex);
      }
    }
    
    // Check if we need to load more videos
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      containerTop + containerHeight > container.scrollHeight - 500
    ) {
      fetchNextPage();
    }
  };

  // Attach scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [hasNextPage, isFetchingNextPage, videos.length]);
  
  // Notify parent about initial visible video
  useEffect(() => {
    if (videos.length > 0 && onVideoVisible) {
      onVideoVisible(currentIndex);
    }
  }, [currentIndex, videos.length, onVideoVisible]);

  return (
    <div 
      ref={containerRef} 
      className="h-full overflow-y-scroll snap-y snap-mandatory"
      style={{ height: 'calc(100vh - 64px)' }} // Adjust height based on your layout
    >
      {videos.map((video, index) => (
        <div 
          key={video.id.toString()}
          ref={(el) => {
            if (el) videoRefs.current[index] = el;
          }}
          className="h-full w-full snap-start"
        >
          <div className="relative h-full w-full flex flex-col">
            <div className="flex-grow flex items-center justify-center bg-black">
              <VideoPlayer
                videoId={video.id}
                title={video.title}
                mediaRef={video.mediaRef}
                thumbnailCid={video.thumbnailCid}
                hlsCid={video.hlsCid}
                duration={Number(video.duration)}
                likes={Number(video.likes)}
                views={Number(video.views)}
                autoPlay={index === currentIndex}
                loop={true}
                controls={true}
                showInfo={false}
                compact={true}
              />
            </div>
            
            {/* Video info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 text-white">
              <h3 className="text-lg font-bold">{video.title}</h3>
              <div className="flex items-center mt-2">
                <span className="mr-3">❤️ {video.likes.toString()}</span>
                <span>👁️ {video.views.toString()} views</span>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {isFetchingNextPage && (
        <div className="flex justify-center items-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
};

export default VideoFeed;