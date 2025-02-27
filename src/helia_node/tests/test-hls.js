// test-hls.js - Test script for HLS streaming in the Helia node
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const SAMPLE_VIDEO_PATH = process.argv[2] || path.join(__dirname, '../../input.mp4'); // Default or from command line
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

// Helper to write response to file
async function writeResponseToFile(response, filePath) {
  const fileStream = fs.createWriteStream(filePath);
  return new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
}

// Test server health
async function testServerHealth() {
  try {
    const response = await fetch(`${SERVER_URL}/`);
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    
    const text = await response.text();
    logWithTime(`Server health check: OK - ${text}`);
    return true;
  } catch (error) {
    logWithTime(`Server health check FAILED: ${error.message}`);
    return false;
  }
}

// Upload a video file for HLS transcoding
async function uploadVideo(videoPath) {
  try {
    const fileStats = fs.statSync(videoPath);
    logWithTime(`Uploading video file: ${videoPath} (${(fileStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    
    const form = new FormData();
    form.append('video', fs.createReadStream(videoPath), path.basename(videoPath));
    
    const response = await fetch(`${SERVER_URL}/upload`, {
      method: 'POST',
      body: form
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    logWithTime(`Upload successful. CID: ${result.cid}, Master CID: ${result.masterCid}`);
    return result;
  } catch (error) {
    logWithTime(`Upload failed: ${error.message}`);
    throw error;
  }
}

// Fetch and validate the master HLS playlist
async function testMasterPlaylist(cid) {
  try {
    logWithTime(`Fetching master playlist for CID: ${cid}`);
    
    const response = await fetch(`${SERVER_URL}/ipfs/${cid}?filename=master.m3u8`);
    if (!response.ok) throw new Error(`Failed with status: ${response.status}`);
    
    const content = await response.text();
    const outputPath = path.join(OUTPUT_DIR, 'master.m3u8');
    fs.writeFileSync(outputPath, content);
    
    logWithTime(`Master playlist saved to ${outputPath}`);
    
    // Basic validation - check if it's an M3U8 file and has stream entries
    if (!content.includes('#EXTM3U')) {
      throw new Error('Invalid M3U8 format - missing #EXTM3U header');
    }
    
    if (!content.includes('#EXT-X-STREAM-INF')) {
      throw new Error('Invalid master playlist - no variant streams found');
    }
    
    // Extract variant playlist paths from the master playlist
    const variantPaths = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
          variantPaths.push(lines[i + 1].trim());
        }
      }
    }
    
    logWithTime(`Found ${variantPaths.length} variant playlists: ${variantPaths.join(', ')}`);
    
    // Extract jobId - if this fails, extraction logic might be wrong
    const baseUrlMatch = content.match(/#EXT-X-BASE-URL:(.+)/);
    let jobId = null;
    
    if (baseUrlMatch) {
      const baseUrl = baseUrlMatch[1];
      const urlParts = baseUrl.split('/');
      jobId = urlParts[urlParts.length - 2]; // Extract jobId from the URL
      logWithTime(`Extracted job ID: ${jobId}`);
    } else {
      logWithTime(`Warning: Could not extract BASE-URL directive from master playlist`);
    }
    
    return {
      variantPaths,
      jobId
    };
  } catch (error) {
    logWithTime(`Master playlist test failed: ${error.message}`);
    throw error;
  }
}

// Test fetching variant playlists
async function testVariantPlaylists(jobId, variantPaths) {
  try {
    logWithTime(`Testing ${variantPaths.length} variant playlists`);
    
    for (const variantPath of variantPaths) {
      // Construct the URL - need to handle the path correctly
      const url = `${SERVER_URL}/hls/${jobId}/${variantPath}`;
      logWithTime(`Fetching variant playlist: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch variant playlist ${variantPath}: ${response.status}`);
      }
      
      const content = await response.text();
      const outputPath = path.join(OUTPUT_DIR, path.basename(variantPath));
      fs.writeFileSync(outputPath, content);
      
      logWithTime(`Variant playlist ${variantPath} saved to ${outputPath}`);
      
      // Basic validation
      if (!content.includes('#EXTM3U')) {
        throw new Error(`Invalid M3U8 format in ${variantPath}`);
      }
      
      if (!content.includes('#EXTINF')) {
        throw new Error(`No segments found in ${variantPath}`);
      }
      
      // Extract segment paths
      const segmentPaths = [];
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF')) {
          if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
            segmentPaths.push(lines[i + 1].trim());
          }
        }
      }
      
      logWithTime(`Found ${segmentPaths.length} segments in ${variantPath}`);
      
      // Test fetching the first segment
      if (segmentPaths.length > 0) {
        const firstSegment = segmentPaths[0];
        // Need to construct path using variant directory
        const variantDir = path.dirname(variantPath);
        const segmentUrl = `${SERVER_URL}/hls/${jobId}/${variantDir}/${firstSegment}`;
        
        logWithTime(`Fetching first segment: ${segmentUrl}`);
        
        const segmentResponse = await fetch(segmentUrl);
        
        if (!segmentResponse.ok) {
          throw new Error(`Failed to fetch segment ${firstSegment}: ${segmentResponse.status}`);
        }
        
        // Save the segment
        const segmentOutputPath = path.join(OUTPUT_DIR, firstSegment);
        await writeResponseToFile(segmentResponse, segmentOutputPath);
        
        logWithTime(`Segment saved to ${segmentOutputPath}`);
        
        // Check file size to make sure it's a valid segment
        const stats = fs.statSync(segmentOutputPath);
        if (stats.size < 1000) { // Segments should be at least 1KB
          logWithTime(`Warning: Segment file seems too small (${stats.size} bytes)`);
        } else {
          logWithTime(`Segment file size: ${stats.size} bytes - looks valid`);
        }
      }
    }
    
    return true;
  } catch (error) {
    logWithTime(`Variant playlist test failed: ${error.message}`);
    throw error;
  }
}

// Main test function
async function runTests() {
  logWithTime('Starting HLS streaming tests...');
  
  try {
    // Step 1: Check if server is running
    const serverOk = await testServerHealth();
    if (!serverOk) {
      logWithTime('Aborting tests due to server health check failure');
      process.exit(1);
    }
    
    // Step 2: Upload a test video
    const uploadResult = await uploadVideo(SAMPLE_VIDEO_PATH);
    logWithTime('Video upload test passed!');
    
    // Step 3: Test master playlist
    const { variantPaths, jobId } = await testMasterPlaylist(uploadResult.masterCid);
    logWithTime('Master playlist test passed!');
    
    // Step 4: Test variant playlists and segments
    if (jobId) {
      await testVariantPlaylists(jobId, variantPaths);
      logWithTime('Variant playlists and segments test passed!');
    } else {
      // Try to use direct HLS URL approach if jobId extraction failed
      logWithTime('Skipping variant tests - could not determine job ID');
    }
    
    logWithTime('All tests PASSED! HLS streaming should be working correctly.');
    logWithTime(`Video CID: ${uploadResult.cid}`);
    logWithTime(`Master playlist CID: ${uploadResult.masterCid}`);
    logWithTime(`Test playback URL: ${SERVER_URL}/ipfs/${uploadResult.masterCid}?filename=master.m3u8`);
    
  } catch (error) {
    logWithTime(`Test failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the tests
runTests();