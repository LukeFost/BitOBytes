// test-direct-stream.js - Test script for direct video streaming from IPFS
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const OUTPUT_DIR = path.join(__dirname, 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to log with timestamp
function logWithTime(message) {
  const now = new Date();
  console.log(`[${now.toISOString()}] ${message}`);
}

/**
 * Test direct video streaming by fetching video chunks
 * @param {string} cid - IPFS CID of the video
 */
async function testDirectVideoStream(cid) {
  try {
    logWithTime(`Testing direct video streaming for CID: ${cid}`);
    
    // First, make a HEAD request to check content type and size
    const headResponse = await fetch(`${SERVER_URL}/ipfs/${cid}?filename=video.mp4`, { 
      method: 'HEAD'
    });
    
    if (!headResponse.ok) {
      throw new Error(`HEAD request failed with status: ${headResponse.status}`);
    }
    
    const contentType = headResponse.headers.get('content-type');
    const contentLength = headResponse.headers.get('content-length');
    
    logWithTime(`Content type: ${contentType}, Size: ${contentLength} bytes`);
    
    if (!contentType?.includes('video')) {
      logWithTime(`Warning: Content type ${contentType} doesn't appear to be video`);
    }
    
    // Test partial content request (range request)
    // Request the first 1MB of the video
    const rangeResponse = await fetch(`${SERVER_URL}/ipfs/${cid}?filename=video.mp4`, {
      headers: {
        'Range': 'bytes=0-1048575' // First 1MB
      }
    });
    
    if (!rangeResponse.ok && rangeResponse.status !== 206) {
      throw new Error(`Range request failed with status: ${rangeResponse.status}`);
    }
    
    // Save the response to a file
    const outputPath = path.join(OUTPUT_DIR, `${cid}-sample.mp4`);
    const buffer = await rangeResponse.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    
    logWithTime(`Saved 1MB sample to ${outputPath}`);
    
    // Verify CORS headers are present
    const corsOrigin = rangeResponse.headers.get('access-control-allow-origin');
    const corsMethods = rangeResponse.headers.get('access-control-allow-methods');
    
    if (!corsOrigin || !corsMethods) {
      logWithTime(`Warning: CORS headers might be missing: Origin: ${corsOrigin}, Methods: ${corsMethods}`);
    } else {
      logWithTime(`CORS headers present: Origin: ${corsOrigin}, Methods: ${corsMethods}`);
    }
    
    return {
      success: true,
      contentType,
      contentLength,
      corsHeaders: {
        origin: corsOrigin,
        methods: corsMethods
      },
      sample: outputPath
    };
  } catch (error) {
    logWithTime(`Direct video streaming test failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test simulated playback by fetching multiple chunks
 */
async function testSimulatedPlayback(cid, totalSize) {
  try {
    // Define three points to request - start, middle, end
    const chunkSize = 65536; // 64KB
    const total = parseInt(totalSize, 10);
    
    if (isNaN(total) || total <= 0) {
      throw new Error('Invalid content length');
    }
    
    const ranges = [
      `bytes=0-${chunkSize-1}`,                          // Start
      `bytes=${Math.floor(total/2)}-${Math.floor(total/2) + chunkSize - 1}`,  // Middle
      `bytes=${total - chunkSize}-${total - 1}`          // End
    ];
    
    logWithTime(`Testing simulated playback with ${ranges.length} range requests`);
    
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      logWithTime(`Fetching chunk ${i+1}/${ranges.length}: ${range}`);
      
      const response = await fetch(`${SERVER_URL}/ipfs/${cid}?filename=video.mp4`, {
        headers: { 'Range': range }
      });
      
      if (!response.ok && response.status !== 206) {
        throw new Error(`Range request failed with status: ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      logWithTime(`Received chunk ${i+1}: ${buffer.byteLength} bytes`);
    }
    
    logWithTime(`Simulated playback test passed - all chunks fetched successfully`);
    return true;
  } catch (error) {
    logWithTime(`Simulated playback test failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main test function
 */
async function runTests(cid) {
  if (!cid) {
    logWithTime('Error: No CID provided. Usage: node test-direct-stream.js <CID>');
    process.exit(1);
  }
  
  logWithTime(`Starting direct video stream tests for CID: ${cid}`);
  
  try {
    // Test basic streaming
    const streamResult = await testDirectVideoStream(cid);
    logWithTime('Direct video streaming test passed!');
    
    // Test simulated playback
    if (streamResult.contentLength) {
      await testSimulatedPlayback(cid, streamResult.contentLength);
      logWithTime('Simulated playback test passed!');
    } else {
      logWithTime('Skipping simulated playback test - no content length available');
    }
    
    logWithTime('All tests PASSED! Direct video streaming should be working correctly.');
    logWithTime(`Test playback URL: ${SERVER_URL}/ipfs/${cid}?filename=video.mp4`);
    
  } catch (error) {
    logWithTime(`Tests failed: ${error.message}`);
    process.exit(1);
  }
}

// Get CID from command line argument
const cid = process.argv[2];
runTests(cid);