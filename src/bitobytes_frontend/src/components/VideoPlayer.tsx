import React, { useEffect, useRef, useState } from 'react';
import { getHlsUrl, getIpfsUrl } from '../utils/ipfs';
import { likeVideo } from '../utils/canisterUtils';
import Hls from 'hls.js';

interface VideoPlayerProps {
  videoId: bigint;
  title: string;
  mediaRef: string;
  thumbnailCid: string;
  hlsCid: string;
  duration: number;
  likes: number;
  views: number;
  onLike?: () => void;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  showInfo?: boolean;
  compact?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  title,
  mediaRef,
  thumbnailCid,
  hlsCid,
  duration,
  likes,
  views,
  onLike,
  autoPlay = false,
  loop = false,
  controls = true,
  showInfo = true,
  compact = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(isNaN(likes) ? 0 : likes);
  const [isLiked, setIsLiked] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);

  useEffect(() => {
    // Check if user has liked the video
    if (videoId) {
      const hasLiked = localStorage.getItem(`liked-${videoId.toString()}`);
      if (hasLiked) {
        setIsLiked(true);
      }
    }
  }, [videoId]);

  // Log props for debugging
  useEffect(() => {
    console.log('VideoPlayer props:', {
      videoId: videoId ? videoId.toString() : 'undefined',
      title,
      mediaRef,
      thumbnailCid,
      hlsCid,
      duration,
      likes,
      views,
      autoPlay,
      loop
    });
  }, [videoId, title, mediaRef, thumbnailCid, hlsCid, duration, likes, views, autoPlay, loop]);

  // Handle video source selection - try HLS first, then fall back to direct video
  // This is the recommended approach since HLS provides adaptive streaming
  const videoSource = hlsCid 
    ? getHlsUrl(hlsCid)
    : (mediaRef ? getIpfsUrl(mediaRef) : '');
  
  console.log('Video source URL:', videoSource);
  console.log('HLS CID:', hlsCid);
  console.log('Media Ref:', mediaRef);
  
  // For debugging
  if (hlsCid) {
    // Try to fetch the HLS content to see if it's accessible
    fetch(videoSource)
      .then(response => {
        console.log('HLS content fetch status:', response.status);
        if (!response.ok) {
          console.warn('HLS content not accessible, will fall back to direct video');
        }
      })
      .catch(error => {
        console.error('Error fetching HLS content:', error);
      });
  }

  // Handle thumbnail
  const thumbnailUrl = thumbnailCid 
    ? getIpfsUrl(thumbnailCid) 
    : '/placeholder-thumbnail.jpg';
  
  console.log('Thumbnail URL:', thumbnailUrl);

  // Format duration
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

  // Handle video play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Could not play video. Please try again.');
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle like button click
  const handleLike = async () => {
    if (!isLiked && videoId) {
      try {
        // Call the backend to like the video
        const success = await likeVideo(videoId);
        if (success) {
          setLikeCount(prev => prev + 1);
          setIsLiked(true);
          localStorage.setItem(`liked-${videoId.toString()}`, 'true');
          if (onLike) onLike();
        }
      } catch (err) {
        console.error('Error liking video:', err);
      }
    }
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Initialize HLS when component mounts or hlsCid changes
  useEffect(() => {
    // Clean up previous HLS instance if it exists
    if (hlsInstance) {
      hlsInstance.destroy();
      setHlsInstance(null);
    }
    
    if (!videoRef.current || !hlsCid) {
      fallbackToDirectVideo();
      return;
    }
    
    // Check if HLS.js is supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        // Debug: true for development
        debug: false,
        // Add any other HLS config options here
        maxBufferLength: 30,
        xhrSetup: function(xhr, url) {
          console.log('XHR request URL:', url);
          // No special handling needed now that we use absolute URLs in the master playlist
        }
      });
      
      // Use the hlsCid for HLS streaming
      const hlsUrl = getHlsUrl(hlsCid);
      console.log('Initializing HLS with URL:', hlsUrl);
      
      // Load source and attach to video element
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);
      
      // Store HLS instance in state
      setHlsInstance(hls);
      
      // Listen for HLS events
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed successfully');
        if (videoRef.current) {
          setLoading(false);
          
          // Autoplay if requested - must be done after manifest is parsed
          if (autoPlay) {
            videoRef.current.play().catch(err => {
              console.error('Autoplay failed:', err);
              // Most browsers require user interaction before autoplay works
              // This is expected behavior, no need to show an error
            });
          }
        }
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data.type, data.details);
        
        // Log HLS errors but no special handling needed for variant playlist errors
        // since we now use absolute URLs in the master playlist
        if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || 
            data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR) {
          console.warn('Error loading playlist:', data.details);
        }
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error', data);
              // Try to recover
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error', data);
              // Try to recover
              hls.recoverMediaError();
              break;
            default:
              console.error('Unrecoverable HLS error');
              // Fall back to direct video
              fallbackToDirectVideo();
              break;
          }
        }
      });
      
      return () => {
        // Clean up HLS
        hls.destroy();
      };
    } else if (videoRef.current && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // For Safari which has native HLS support
      console.log('Using native HLS support');
      videoRef.current.src = getHlsUrl(hlsCid);
      
      // Autoplay if requested for Safari
      if (autoPlay && videoRef.current) {
        videoRef.current.play().catch(err => {
          console.error('Autoplay failed in Safari:', err);
        });
      }
    } else {
      console.warn('HLS is not supported in this browser, falling back to direct video');
      fallbackToDirectVideo();
    }
  }, [hlsCid, autoPlay]);
  
  // Handle autoplay status changes when in feed view
  useEffect(() => {
    if (videoRef.current) {
      if (autoPlay && !isPlaying) {
        videoRef.current.play().catch(err => {
          console.error('Autoplay failed on status change:', err);
        });
      } else if (!autoPlay && isPlaying) {
        videoRef.current.pause();
      }
    }
  }, [autoPlay, isPlaying]);
  
  const fallbackToDirectVideo = () => {
    if (!videoRef.current || !mediaRef) {
      setError('Failed to load video. Please try again later.');
      setLoading(false);
      return;
    }
    
    console.log('Falling back to direct video');
    setUsingFallback(true);
    const directUrl = getIpfsUrl(mediaRef);
    console.log('Setting fallback URL:', directUrl);
    videoRef.current.src = directUrl;
    videoRef.current.load(); // Force reload with new source
    
    // Autoplay if requested for direct video
    if (autoPlay) {
      videoRef.current.play().catch(err => {
        console.error('Autoplay failed for direct video:', err);
      });
    }
    
    setError(null); // Clear any previous errors
  };

  // Handle video error
  const handleVideoError = () => {
    console.error('Video playback error. Source:', videoRef.current?.src);
    
    // If we're already using the direct video as fallback and it failed, show an error
    if (usingFallback || !mediaRef) {
      console.error('Direct video playback failed');
      setError('Failed to load video. Please try again later.');
      setLoading(false);
      return;
    }
    
    // Try direct video as fallback
    fallbackToDirectVideo();
  };

  // If compact mode (for feed), use a simplified player
  if (compact) {
    return (
      <div className="video-player-compact w-full">
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            // Only set src directly when using fallback or native HLS in Safari
            // Otherwise, HLS.js will handle the src assignment
            src={usingFallback ? getIpfsUrl(mediaRef) : (hlsInstance ? undefined : videoSource)}
            poster={thumbnailUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadStart={() => setLoading(true)}
            onLoadedData={() => {
              setLoading(false);
              console.log('Video loaded successfully:', videoRef.current?.src);
            }}
            onError={handleVideoError}
            controls={controls}
            loop={loop}
            playsInline
            muted={autoPlay} // Muted for autoplay on mobile
          />
          
          {/* Loading indicator */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="text-white bg-red-600 px-4 py-2 rounded">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="video-player rounded-lg overflow-hidden bg-gray-900">
      {/* Video container */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          // Only set src directly when using fallback or native HLS in Safari
          // Otherwise, HLS.js will handle the src assignment
          src={usingFallback ? getIpfsUrl(mediaRef) : (hlsInstance ? undefined : videoSource)}
          poster={thumbnailUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadStart={() => setLoading(true)}
          onLoadedData={() => {
            setLoading(false);
            console.log('Video loaded successfully:', videoRef.current?.src);
          }}
          onError={handleVideoError}
          controls={controls}
          loop={loop}
          playsInline
          muted={autoPlay} // Muted for autoplay on mobile
        />
        
        {/* Loading indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white bg-red-600 px-4 py-2 rounded">
              {error}
            </div>
          </div>
        )}
        
        {/* Fallback indicator */}
        {usingFallback && !error && !loading && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded">
            Playing original video
          </div>
        )}
      </div>
      
      {/* Video info - only show if showInfo is true */}
      {showInfo && (
        <div className="p-4 bg-white">
          <h3 className="text-xl font-bold mb-2">{title}</h3>
          
          <div className="flex justify-between items-center mb-4">
            <div className="text-gray-600 text-sm">
              {formatViews(views)} views • {formatDuration(duration)}
            </div>
            
            <div className="flex items-center">
              <button 
                onClick={handleLike}
                className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
                  isLiked ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200'
                }`}
                disabled={isLiked}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  viewBox="0 0 20 20" 
                  fill={isLiked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth={isLiked ? "0" : "1.5"}
                >
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                <span>{likeCount}</span>
              </button>
              
              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: title,
                      text: `Check out this video: ${title}`,
                      url: window.location.href,
                    })
                    .catch((error) => console.log('Error sharing:', error));
                  } else {
                    // Fallback for browsers that don't support the Web Share API
                    navigator.clipboard.writeText(window.location.href)
                      .then(() => alert('Link copied to clipboard!'))
                      .catch(err => console.error('Could not copy link:', err));
                  }
                }}
                className="flex items-center space-x-1 px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 ml-2"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  viewBox="0 0 20 20" 
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
                <span>Share</span>
              </button>
            </div>
          </div>
          
          {/* Video details/description would go here */}
          <div className="text-sm text-gray-700 mt-4 pt-4 border-t">
            <p>Video ID: {videoId ? videoId.toString() : 'N/A'}</p>
            <p className="truncate">IPFS CID: {mediaRef || 'N/A'}</p>
            {hlsCid && <p className="truncate">HLS CID: {hlsCid}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;