// src/bitobytes_frontend/src/utils/ipfs.ts

/**
 * Utility functions for interacting with IPFS via the local Helia node
 */

// Helia node API URL from environment
const HELIA_API_URL = process.env.NEXT_PUBLIC_HELIA_API_URL || 'http://localhost:3001';

/**
 * Upload a file to IPFS via the local Helia node
 * @param file File to upload
 * @param onProgress Optional callback for progress updates
 * @returns Promise resolving to the IPFS CID
 */
export async function uploadToIpfs(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string> {
  // Create form data with the file
  const formData = new FormData();
  formData.append('video', file);
  
  try {
    // Implement a simple progress simulation since we don't have real progress from fetch
    if (onProgress) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        if (progress > 95) {
          clearInterval(interval);
          progress = 95; // Wait for actual completion to show 100%
        }
        onProgress(progress);
      }, 500);
    }
    
    // Send request to the Helia node
    const response = await fetch(`${HELIA_API_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to upload to IPFS: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    
    // Upload complete - set progress to 100%
    if (onProgress) onProgress(100);
    
    return data.cid;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw error;
  }
}

/**
 * Get the URL for accessing content from IPFS
 * @param cid IPFS CID of the content
 * @param path Optional path within a directory
 * @returns URL to access the content
 */
export function getIpfsUrl(cid: string, path?: string): string {
  if (!cid) return '';
  
  if (path) {
    return `${HELIA_API_URL}/ipfs/${cid}/${path}`;
  }
  return `${HELIA_API_URL}/ipfs/${cid}`;
}

/**
 * Get the URL for accessing HLS content from IPFS
 * @param hlsCid IPFS CID of the HLS directory or master.m3u8 file
 * @returns URL to access the HLS master playlist
 */
export function getHlsUrl(hlsCid: string): string {
  if (!hlsCid) return '';
  
  // Access the master.m3u8 file directly from IPFS
  // Add filename hint to help with content-type detection
  return `${HELIA_API_URL}/ipfs/${hlsCid}?filename=master.m3u8`;
}

/**
 * Generate a thumbnail from a video file
 * @param videoFile Video file to generate thumbnail from
 * @returns Promise resolving to a Blob containing the thumbnail image
 */
export async function generateVideoThumbnail(videoFile: File): Promise<Blob> {
  // Create a video element to load the file
  const video = document.createElement('video');
  const videoUrl = URL.createObjectURL(videoFile);
  
  return new Promise((resolve, reject) => {
    video.onloadeddata = async () => {
      try {
        // Seek to 25% of the video duration for the thumbnail
        video.currentTime = video.duration * 0.25;
      } catch (error) {
        URL.revokeObjectURL(videoUrl);
        reject(error);
      }
    };
    
    video.onseeked = () => {
      try {
        // Create a canvas to draw the thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the video frame to the canvas
        const ctx = canvas.getContext('2d');
        ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Clean up the video element
        URL.revokeObjectURL(videoUrl);
        
        // Convert the canvas to a blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        }, 'image/jpeg', 0.8);
      } catch (error) {
        URL.revokeObjectURL(videoUrl);
        reject(error);
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Error loading video'));
    };
    
    // Load the video
    video.src = videoUrl;
    video.load();
  });
}
