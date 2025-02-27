// test-hls-fallback.js - Test script for variant playlist fallback behavior
// Run with: node test-hls-fallback.js [job_id]

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SERVER_URL = process.env.HELIA_SERVER || 'http://localhost:3001';
const OUTPUT_DIR = path.join(__dirname, 'debug-output', 'hls-test');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to log with timestamp
function logWithTime(message) {
  const now = new Date();
  console.log(`[${now.toISOString()}] ${message}`);
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper to fetch and save content
async function fetchWithStatusCheck(url) {
  try {
    logWithTime(`${colors.blue}Fetching: ${url}${colors.reset}`);
    const response = await fetch(url);
    
    if (response.ok) {
      logWithTime(`${colors.green}Success (${response.status}): ${url}${colors.reset}`);
      return {
        ok: true,
        status: response.status,
        redirected: response.redirected,
        redirectUrl: response.redirected ? response.url : null,
        contentType: response.headers.get('content-type'),
        content: response.headers.get('content-type')?.includes('text') ? 
                await response.text() : 
                await response.arrayBuffer()
      };
    } else {
      logWithTime(`${colors.red}Failed (${response.status}): ${url}${colors.reset}`);
      return {
        ok: false,
        status: response.status,
        redirected: response.redirected,
        redirectUrl: response.redirected ? response.url : null
      };
    }
  } catch (error) {
    logWithTime(`${colors.red}Error fetching ${url}: ${error.message}${colors.reset}`);
    return {
      ok: false,
      error: error.message
    };
  }
}

// Save content to file
function saveToFile(content, filename) {
  const outputPath = path.join(OUTPUT_DIR, filename);
  
  try {
    if (typeof content === 'string') {
      fs.writeFileSync(outputPath, content);
    } else {
      fs.writeFileSync(outputPath, Buffer.from(content));
    }
    logWithTime(`${colors.green}Saved to: ${outputPath}${colors.reset}`);
    return true;
  } catch (error) {
    logWithTime(`${colors.red}Error saving to ${outputPath}: ${error.message}${colors.reset}`);
    return false;
  }
}

// Run HLS fallback tests
async function testHlsFallback(jobId) {
  logWithTime(`${colors.magenta}Starting HLS fallback test for job ID: ${jobId}${colors.reset}`);
  
  // Test 1: Master playlist
  logWithTime(`${colors.cyan}Test 1: Fetching master playlist${colors.reset}`);
  const masterUrl = `${SERVER_URL}/hls/${jobId}/master.m3u8`;
  const masterResult = await fetchWithStatusCheck(masterUrl);
  
  if (masterResult.ok) {
    saveToFile(masterResult.content, 'master.m3u8');
    
    // Parse master playlist to get variants
    const masterContent = masterResult.content.toString();
    const variantMatches = masterContent.match(/^[^#].*\.m3u8$/gm);
    const variants = variantMatches || [];
    
    logWithTime(`${colors.cyan}Found ${variants.length} variants in master playlist${colors.reset}`);
    
    // Simulate requests to each variant
    for (const variant of variants) {
      const variantUrl = `${SERVER_URL}/hls/${jobId}/${variant}`;
      logWithTime(`${colors.cyan}Test 2: Fetching variant playlist: ${variant}${colors.reset}`);
      const variantResult = await fetchWithStatusCheck(variantUrl);
      
      if (variantResult.ok) {
        saveToFile(variantResult.content, variant);
      }
    }
    
    // Test 3: Simulate missing variant requests
    const testVariants = ['360p/playlist.m3u8', '480p/playlist.m3u8', '720p/playlist.m3u8'];
    
    for (const testVariant of testVariants) {
      logWithTime(`${colors.cyan}Test 3: Testing fallback for ${testVariant}${colors.reset}`);
      const result = await fetchWithStatusCheck(`${SERVER_URL}/hls/${jobId}/${testVariant}`);
      
      if (result.ok) {
        if (result.redirected) {
          logWithTime(`${colors.green}Redirect successful: ${result.redirectUrl}${colors.reset}`);
        } else {
          logWithTime(`${colors.green}Direct access successful${colors.reset}`);
        }
        saveToFile(result.content, `fallback-${testVariant.replace('/', '-')}`);
      }
    }
  } else {
    logWithTime(`${colors.red}Master playlist not found. Cannot continue testing.${colors.reset}`);
  }
  
  // Test 4: Test the IPFS path (this will fail but we want to see how it fails)
  logWithTime(`${colors.cyan}Test 4: Testing IPFS path with this Job ID${colors.reset}`);
  
  // Simulate HLS.js requesting variant playlists directly from IPFS path
  const testIpfsVariants = ['360p/playlist.m3u8', '480p/playlist.m3u8', '720p/playlist.m3u8'];
  
  for (const variant of testIpfsVariants) {
    const ipfsUrl = `${SERVER_URL}/ipfs/${variant}?jobid=${jobId}`;
    logWithTime(`${colors.cyan}Requesting variant via IPFS path: ${ipfsUrl}${colors.reset}`);
    const result = await fetchWithStatusCheck(ipfsUrl);
    
    if (result.ok) {
      if (result.redirected) {
        logWithTime(`${colors.green}IPFS redirect successful: ${result.redirectUrl}${colors.reset}`);
      } else {
        logWithTime(`${colors.green}IPFS direct access successful${colors.reset}`);
      }
      saveToFile(result.content, `ipfs-${variant.replace('/', '-')}`);
    }
  }
  
  logWithTime(`${colors.magenta}HLS fallback testing complete${colors.reset}`);
}

// Main function
async function main() {
  // Get job ID from command line arguments
  const jobId = process.argv[2];
  
  if (!jobId) {
    console.log(`
${colors.red}ERROR: No job ID provided${colors.reset}

Usage: node test-hls-fallback.js <job_id>

You can find job IDs by:
1. Looking at the server logs after a successful upload
2. Checking the temp directory for UUID-style folder names
`);
    process.exit(1);
  }
  
  await testHlsFallback(jobId);
}

main().catch(error => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});