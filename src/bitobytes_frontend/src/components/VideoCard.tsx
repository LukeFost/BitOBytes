import React from 'react';
import { useRouter } from 'next/router';
import { Video } from '../utils/canisterUtils';
import { getIpfsUrl } from '../utils/ipfs';
import AddToQueueButton from './AddToQueueButton';

interface VideoCardProps {
  video: Video;
  onPlay?: (video: Video) => void;
  compact?: boolean;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, onPlay, compact = false }) => {
  const router = useRouter();
  
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number) => {
    if (isNaN(seconds)) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Format view count
  const formatViews = (count: number) => {
    if (isNaN(count)) {
      return '0';
    } else if (count >= 1000000) {
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

  // Handle click - either navigate to video detail or call onPlay callback
  const handleClick = (e: React.MouseEvent) => {
    // If the click came from the add-to-queue button, don't navigate
    if ((e.target as HTMLElement).closest('.add-to-queue-btn')) {
      return;
    }

    if (onPlay) {
      onPlay(video);
    } else {
      router.push(`/video/${video.id.toString()}`);
    }
  };

  // Handle thumbnail
  const thumbnailUrl = video.thumbnailCid 
    ? getIpfsUrl(video.thumbnailCid) 
    : '/placeholder-thumbnail.jpg';

  if (compact) {
    // Compact version for feed view
    return (
      <div 
        className="flex items-center p-2 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleClick}
      >
        <div className="w-24 h-16 relative flex-shrink-0 bg-gray-100">
          <img 
            src={thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = '/placeholder-thumbnail.jpg';
            }}
          />
          <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
            {formatDuration(Number(video.duration))}
          </div>
        </div>
        
        <div className="ml-3 overflow-hidden flex-grow">
          <h3 className="text-sm font-medium line-clamp-2">{video.title}</h3>
          <div className="text-xs text-gray-500 mt-1 flex items-center">
            <span>{formatViews(Number(video.views))} views</span>
            <span className="mx-1">•</span>
            <span>{formatDate(video.timestamp)}</span>
          </div>
        </div>
        
        <div className="ml-2 add-to-queue-btn">
          <AddToQueueButton 
            videoId={video.id} 
            className="h-8 w-8 p-1"
          />
        </div>
      </div>
    );
  }

  // Default card layout
  return (
    <div 
      className="video-card bg-white shadow-md rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-200">
        <img 
          src={thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = '/placeholder-thumbnail.jpg';
          }}
        />
        
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
          {formatDuration(Number(video.duration))}
        </div>
        
        {/* Add to queue button (floating on top of thumbnail) */}
        <div className="absolute top-2 right-2 add-to-queue-btn">
          <AddToQueueButton 
            videoId={video.id} 
            className="h-8 w-8 p-1"
          />
        </div>
      </div>
      
      {/* Video info */}
      <div className="p-3">
        <h3 className="text-base font-medium line-clamp-2">{video.title}</h3>
        <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
          <div>
            {formatViews(Number(video.views))} views
          </div>
          <div className="flex items-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 mr-1" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
            {Number(video.likes)}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {formatDate(video.timestamp)}
        </p>
      </div>
    </div>
  );
};

export default VideoCard;