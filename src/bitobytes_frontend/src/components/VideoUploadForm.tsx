// src/bitobytes_frontend/src/components/VideoUploadForm.tsx

import React, { useState, useRef } from 'react';
import { getBackendActor } from '../utils/canisterUtils';
import { uploadToIpfs, generateVideoThumbnail } from '../utils/ipfs';

const MAX_VIDEO_SIZE_MB = 100; // Increased limit since we're using our own node
const MAX_VIDEO_DURATION_SEC = 300; //d 5 minutes

interface VideoUploadFormProps {
  onSuccess?: (videoId: bigint) => void;
  onError?: (error: string) => void;
}

const VideoUploadForm: React.FC<VideoUploadFormProps> = ({ onSuccess, onError }) => {
  const [title, setTitle] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingHls, setProcessingHls] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Handle video file selection
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setVideoFile(null);
      setDuration(0);
      return;
    }
    
    const file = files[0];
    const fileSizeMB = file.size / (1024 * 1024);
    
    // Check file size
    if (fileSizeMB > MAX_VIDEO_SIZE_MB) {
      setErrorMsg(`Video size (${fileSizeMB.toFixed(2)}MB) exceeds the maximum allowed (${MAX_VIDEO_SIZE_MB}MB)`);
      e.target.value = '';
      return;
    }
    
    // Reset error message
    setErrorMsg('');
    setVideoFile(file);
    
    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION_SEC) {
        setErrorMsg(`Video duration (${video.duration.toFixed(1)}s) exceeds the maximum allowed (${MAX_VIDEO_DURATION_SEC}s)`);
        setVideoFile(null);
        e.target.value = '';
      } else {
        setDuration(video.duration);
        
        // Automatically generate thumbnail if not manually selected
        if (!thumbnailFile) {
          generateVideoThumbnail(file)
            .then(thumbnailBlob => {
              const thumbnailFile = new File([thumbnailBlob], `${file.name}-thumbnail.jpg`, { type: 'image/jpeg' });
              setThumbnailFile(thumbnailFile);
            })
            .catch(err => {
              console.error('Error generating thumbnail:', err);
              // Continue without thumbnail if generation fails
            });
        }
      }
    };
    video.src = URL.createObjectURL(file);
  };
  
  // Handle thumbnail file selection
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setThumbnailFile(null);
      return;
    }
    
    setThumbnailFile(files[0]);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoFile) {
      setErrorMsg('Please select a video to upload');
      return;
    }
    
    if (!title) {
      setErrorMsg('Please enter a title for the video');
      return;
    }
    
    setErrorMsg('');
    setUploading(true);
    setProcessingStep('Uploading video to IPFS...');
    
    try {
      // Upload video to IPFS via Helia
      // The server will process the video for HLS streaming
      const formData = new FormData();
      formData.append('video', videoFile);
      
      // Simulate progress updates
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
        if (progress > 95) {
          clearInterval(progressInterval);
          progress = 95; // Wait for actual completion to show 100%
        }
        setUploadProgress(progress);
      }, 500);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_HELIA_API_URL || 'http://localhost:3001'}/upload`, {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to upload to IPFS: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Upload failed');
      }
      
      const videoCid = data.cid;
      const hlsCid = data.masterCid || '';
      
      console.log('Video uploaded with CID:', videoCid);
      console.log('HLS content CID:', hlsCid || 'Not available');
      
      // Upload thumbnail to IPFS if available
      setProcessingStep('Processing thumbnail...');
      let thumbnailCid = '';
      if (thumbnailFile) {
        // Use the utility function for thumbnail upload
        thumbnailCid = await uploadToIpfs(thumbnailFile);
      }
      
      // Store metadata in the canister
      setProcessingStep('Storing metadata...');
      const actor = await getBackendActor();
      const videoId = await actor.addVideo(
        title,
        videoCid,        // mediaRef (IPFS CID for original video)
        thumbnailCid,    // IPFS CID for thumbnail
        hlsCid,          // IPFS CID for HLS content
        Math.round(duration)
      );
      
      console.log('Video metadata stored successfully:', videoId.toString());
      
      // Clear form after successful upload
      setTitle('');
      setVideoFile(null);
      setThumbnailFile(null);
      setUploadProgress(0);
      setProcessingStep('');
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(videoId);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMsg(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Call error callback if provided
      if (onError) {
        onError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setUploading(false);
      setProcessingHls(false);
      setProcessingStep('');
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Upload Video</h2>
      
      {errorMsg && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMsg}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="title" className="block text-gray-700 font-medium mb-2">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploading}
            placeholder="Enter video title"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="video" className="block text-gray-700 font-medium mb-2">
            Video File
          </label>
          <input
            type="file"
            id="video"
            onChange={handleVideoChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            accept="video/*"
            disabled={uploading}
            required
          />
          {videoFile && (
            <div className="mt-2 text-sm text-gray-600">
              <p>File: {videoFile.name}</p>
              <p>Size: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              <p>Duration: {duration.toFixed(1)} seconds</p>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Maximum size: {MAX_VIDEO_SIZE_MB}MB, Maximum duration: {MAX_VIDEO_DURATION_SEC} seconds
          </p>
        </div>
        
        <div className="mb-4">
          <label htmlFor="thumbnail" className="block text-gray-700 font-medium mb-2">
            Thumbnail Image (Optional)
          </label>
          <input
            type="file"
            id="thumbnail"
            onChange={handleThumbnailChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            accept="image/*"
            disabled={uploading}
          />
          {thumbnailFile && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">Thumbnail: {thumbnailFile.name}</p>
              <img 
                src={URL.createObjectURL(thumbnailFile)} 
                alt="Thumbnail preview" 
                className="mt-2 h-24 object-cover rounded"
              />
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            If not provided, a thumbnail will be generated automatically
          </p>
        </div>
        
        {uploading && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {processingStep || `Uploading: ${uploadProgress}% complete`}
            </p>
          </div>
        )}
        
        <button
          type="submit"
          disabled={uploading || !videoFile || !title}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {uploading ? 'Processing...' : 'Upload Video'}
        </button>
      </form>
    </div>
  );
};

export default VideoUploadForm;
