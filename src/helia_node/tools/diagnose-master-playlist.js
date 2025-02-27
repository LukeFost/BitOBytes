// diagnose-master-playlist.js - Tool to debug and fix issues with master.m3u8 playlists
// Used when HLS.js has trouble loading variant playlists from the master playlist

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Configure paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SERVER_URL = process.env.HELIA_SERVER || 'http://localhost:3001';
const DEBUG_DIR = path.join(__dirname, 'debug-output', 'playlists');

// Ensure debug directory exists
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
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

// Fetch a playlist from the server
async function fetchPlaylist(url) {
  try {
    logWithTime(`${colors.blue}Fetching: ${url}${colors.reset}`);
    const response = await fetch(url);
    
    if (response.ok) {
      const content = await response.text();
      logWithTime(`${colors.green}Success (${response.status}): ${url}${colors.reset}`);
      return content;
    } else {
      logWithTime(`${colors.red}Failed (${response.status}): ${url}${colors.reset}`);
      return null;
    }
  } catch (error) {
    logWithTime(`${colors.red}Error fetching ${url}: ${error.message}${colors.reset}`);
    return null;
  }
}

// Save content to a file
function saveToFile(content, filename) {
  const outputPath = path.join(DEBUG_DIR, filename);
  
  try {
    fs.writeFileSync(outputPath, content);
    logWithTime(`${colors.green}Saved to: ${outputPath}${colors.reset}`);
    return outputPath;
  } catch (error) {
    logWithTime(`${colors.red}Error saving to ${outputPath}: ${error.message}${colors.reset}`);
    return null;
  }
}

// Parse an M3U8 playlist and extract useful information
function parsePlaylist(content, isVariant = false) {
  const lines = content.split('\n');
  const result = {
    version: null,
    baseUrl: null,
    variants: [], // for master playlist
    segments: [], // for variant playlist
    originalContent: content
  };
  
  // Extract directives
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXT-X-VERSION:')) {
      result.version = line.substring('#EXT-X-VERSION:'.length);
    } else if (line.startsWith('#EXT-X-BASE-URL:')) {
      result.baseUrl = line.substring('#EXT-X-BASE-URL:'.length);
    } else if (!isVariant && line.startsWith('#EXT-X-STREAM-INF:')) {
      // Extract variant information from master playlist
      const attributes = line.substring('#EXT-X-STREAM-INF:'.length).split(',');
      const variant = {};
      
      attributes.forEach(attr => {
        const [key, value] = attr.split('=');
        variant[key] = value?.replace(/"/g, ''); // Remove quotes if present
      });
      
      // Get the variant URL from the next line
      if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
        variant.url = lines[i + 1].trim();
        result.variants.push(variant);
      }
    } else if (isVariant && line.startsWith('#EXTINF:')) {
      // Extract segment information from variant playlist
      const duration = parseFloat(line.substring('#EXTINF:'.length).split(',')[0]);
      
      // Get the segment URL from the next line
      if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
        result.segments.push({
          duration,
          url: lines[i + 1].trim()
        });
      }
    }
  }
  
  return result;
}

// Create a fixed master playlist with explicit jobId information
function createFixedMasterPlaylist(original, jobId) {
  const parsed = parsePlaylist(original);
  const lines = original.split('\n');
  let fixed = '';
  
  // Add the base URL directive if it doesn't already exist
  let hasBaseUrl = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Check for existing base URL
    if (line.startsWith('#EXT-X-BASE-URL:')) {
      hasBaseUrl = true;
      // Update the base URL to use our jobId
      fixed += `#EXT-X-BASE-URL:${SERVER_URL}/hls/${jobId}/\n`;
      continue;
    }
    
    // If it's a variant URL (not starting with #), modify it to include the jobId
    if (!line.startsWith('#') && line.endsWith('.m3u8')) {
      fixed += `${line}?jobid=${jobId}\n`;
    } else {
      fixed += `${line}\n`;
    }
  }
  
  // If no base URL directive was found, add it after version
  if (!hasBaseUrl) {
    const versionIndex = fixed.indexOf('#EXT-X-VERSION:');
    if (versionIndex !== -1) {
      // Find the end of the version line
      const lineEnd = fixed.indexOf('\n', versionIndex);
      if (lineEnd !== -1) {
        fixed = fixed.substring(0, lineEnd + 1) +
               `#EXT-X-BASE-URL:${SERVER_URL}/hls/${jobId}/\n` +
               fixed.substring(lineEnd + 1);
      }
    }
  }
  
  return fixed;
}

// Diagnose and fix issues with a master playlist
async function diagnoseMasterPlaylist(cidOrJobId) {
  logWithTime(`${colors.magenta}Starting diagnosis for: ${cidOrJobId}${colors.reset}`);
  
  // Create a folder for this diagnostic run
  const runDir = path.join(DEBUG_DIR, cidOrJobId);
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }
  
  // Try to determine if this is a CID or a job ID (UUID format)
  const isJobId = cidOrJobId.includes('-') && cidOrJobId.length > 30;
  
  // Fetch the master playlist
  const masterUrl = isJobId
    ? `${SERVER_URL}/hls/${cidOrJobId}/master.m3u8`
    : `${SERVER_URL}/ipfs/${cidOrJobId}?filename=master.m3u8`;
  
  logWithTime(`${colors.cyan}Fetching master playlist from: ${masterUrl}${colors.reset}`);
  const masterContent = await fetchPlaylist(masterUrl);
  
  if (!masterContent) {
    logWithTime(`${colors.red}Couldn't fetch master playlist. Diagnosis failed.${colors.reset}`);
    return;
  }
  
  // Save the original master playlist
  saveToFile(masterContent, `${cidOrJobId}/original-master.m3u8`);
  
  // Parse the master playlist
  const parsedMaster = parsePlaylist(masterContent);
  
  // Log master playlist information
  logWithTime(`${colors.cyan}Master playlist information:${colors.reset}`);
  logWithTime(`Version: ${parsedMaster.version}`);
  logWithTime(`Base URL: ${parsedMaster.baseUrl || 'Not specified'}`);
  logWithTime(`Variants: ${parsedMaster.variants.length}`);
  
  // Determine the job ID if it wasn't already known
  let jobId = isJobId ? cidOrJobId : null;
  
  if (!jobId && parsedMaster.baseUrl) {
    // Try to extract job ID from the base URL
    const match = parsedMaster.baseUrl.match(/\/hls\/([^/]+)/);
    if (match) {
      jobId = match[1];
      logWithTime(`${colors.green}Extracted job ID from base URL: ${jobId}${colors.reset}`);
    }
  }
  
  if (!jobId) {
    // If we still don't have a job ID, use the CID as a fallback
    jobId = cidOrJobId;
    logWithTime(`${colors.yellow}No job ID found in playlist. Using CID as job ID: ${jobId}${colors.reset}`);
  }
  
  // Create a fixed version of the master playlist
  const fixedMaster = createFixedMasterPlaylist(masterContent, jobId);
  saveToFile(fixedMaster, `${cidOrJobId}/fixed-master.m3u8`);
  
  // Test each variant playlist
  logWithTime(`${colors.cyan}Testing variant playlists:${colors.reset}`);
  
  for (const variant of parsedMaster.variants) {
    const variantUrl = parsedMaster.baseUrl
      ? `${parsedMaster.baseUrl}${variant.url}`
      : `${SERVER_URL}/hls/${jobId}/${variant.url}`;
    
    logWithTime(`Testing variant: ${variant.url} (${variant.NAME || 'unnamed'})`);
    logWithTime(`URL: ${variantUrl}`);
    
    const variantContent = await fetchPlaylist(variantUrl);
    
    if (variantContent) {
      saveToFile(variantContent, `${cidOrJobId}/${variant.url}`);
      
      // Parse the variant playlist
      const parsedVariant = parsePlaylist(variantContent, true);
      logWithTime(`Segments: ${parsedVariant.segments.length}`);
      
      // Test the first segment if there are any
      if (parsedVariant.segments.length > 0) {
        const segmentUrl = parsedMaster.baseUrl
          ? `${parsedMaster.baseUrl}${path.dirname(variant.url)}/${parsedVariant.segments[0].url}`
          : `${SERVER_URL}/hls/${jobId}/${path.dirname(variant.url)}/${parsedVariant.segments[0].url}`;
        
        logWithTime(`Testing first segment: ${parsedVariant.segments[0].url}`);
        logWithTime(`URL: ${segmentUrl}`);
        
        // Just check if the segment exists, don't download the full thing
        const segResponse = await fetch(segmentUrl, { method: 'HEAD' });
        logWithTime(`Segment status: ${segResponse.status} ${segResponse.statusText}`);
      }
    } else {
      logWithTime(`${colors.red}Variant playlist not found: ${variant.url}${colors.reset}`);
    }
  }
  
  // Create an HTML test player for this playlist
  const playerHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>HLS Player for ${cidOrJobId}</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    video { width: 100%; margin: 20px 0; }
    pre { background: #f4f4f4; padding: 10px; overflow: auto; }
    .log { max-height: 300px; overflow-y: auto; margin-top: 20px; }
    .error { color: red; }
    .success { color: green; }
    .button { background: #4CAF50; color: white; border: none; padding: 8px 16px; cursor: pointer; margin: 5px; }
  </style>
</head>
<body>
  <h1>HLS Test Player</h1>
  <p>Testing ID: <strong>${cidOrJobId}</strong> (Job ID: <strong>${jobId}</strong>)</p>
  
  <div>
    <button class="button" id="loadOriginal">Load Original Master</button>
    <button class="button" id="loadFixed">Load Fixed Master</button>
    <button class="button" id="loadDirect">Load Direct HLS</button>
  </div>
  
  <video id="video" controls></video>
  
  <h3>Current URL:</h3>
  <pre id="currentUrl"></pre>
  
  <h3>Log:</h3>
  <div class="log" id="log"></div>
  
  <script>
    const video = document.getElementById('video');
    const log = document.getElementById('log');
    const currentUrlDisplay = document.getElementById('currentUrl');
    
    function writeLog(message, isError = false) {
      const item = document.createElement('div');
      item.textContent = message;
      item.className = isError ? 'error' : '';
      log.prepend(item);
    }
    
    function loadHLS(url) {
      // Destroy any existing HLS instance
      if (window.hls) {
        window.hls.destroy();
      }
      
      currentUrlDisplay.textContent = url;
      
      // Check if HLS.js is supported
      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: true,
          xhrSetup: function(xhr, url) {
            writeLog('XHR request: ' + url);
          }
        });
        
        hls.on(Hls.Events.ERROR, function(event, data) {
          writeLog('HLS Error: ' + data.details, true);
          console.error('HLS error:', data);
        });
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          writeLog('HLS manifest parsed successfully!');
          video.play();
        });
        
        hls.loadSource(url);
        hls.attachMedia(video);
        window.hls = hls;
      } else {
        writeLog('HLS.js is not supported in this browser', true);
      }
    }
    
    // Load the original master playlist
    document.getElementById('loadOriginal').addEventListener('click', function() {
      loadHLS('${SERVER_URL}/ipfs/${cidOrJobId}?filename=master.m3u8');
    });
    
    // Load the fixed master playlist
    document.getElementById('loadFixed').addEventListener('click', function() {
      // Fetch our local fixed playlist
      fetch('fixed-master.m3u8')
        .then(response => response.text())
        .then(text => {
          // Create a blob URL for the fixed playlist
          const blob = new Blob([text], { type: 'application/vnd.apple.mpegurl' });
          const url = URL.createObjectURL(blob);
          loadHLS(url);
        })
        .catch(error => {
          writeLog('Error loading fixed playlist: ' + error.message, true);
        });
    });
    
    // Load the direct HLS URL
    document.getElementById('loadDirect').addEventListener('click', function() {
      loadHLS('${SERVER_URL}/hls/${jobId}/master.m3u8');
    });
    
    // Load original by default
    loadHLS('${SERVER_URL}/ipfs/${cidOrJobId}?filename=master.m3u8');
  </script>
</body>
</html>
  `;
  
  const playerPath = saveToFile(playerHtml, `${cidOrJobId}/test-player.html`);
  
  if (playerPath) {
    logWithTime(`${colors.green}Created test player: file://${playerPath}${colors.reset}`);
    logWithTime(`${colors.green}Open this file in your browser to test playback${colors.reset}`);
  }
  
  // Summary
  logWithTime(`${colors.magenta}Diagnosis completed for ${cidOrJobId}${colors.reset}`);
  logWithTime(`${colors.green}Job ID: ${jobId}${colors.reset}`);
  logWithTime(`${colors.green}Files saved to: ${runDir}${colors.reset}`);
  logWithTime(`${colors.green}Direct HLS URL: ${SERVER_URL}/hls/${jobId}/master.m3u8${colors.reset}`);
}

// Main function
async function main() {
  // Get CID/job ID from command line arguments
  const cidOrJobId = process.argv[2];
  
  if (!cidOrJobId) {
    console.log(`
${colors.red}ERROR: No CID or job ID provided${colors.reset}

Usage: node diagnose-master-playlist.js <cid_or_job_id>

Examples:
  node diagnose-master-playlist.js bafkreih3plwi4lxx4v5fn3diufmmpwkn6ud46d26u6gdirsyaezcwc5hc4
  node diagnose-master-playlist.js 123e4567-e89b-12d3-a456-426614174000
`);
    process.exit(1);
  }
  
  await diagnoseMasterPlaylist(cidOrJobId);
}

main().catch(error => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});