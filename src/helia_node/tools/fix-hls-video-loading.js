// fix-hls-video-loading.js - Script to debug and fix HLS video loading issues

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { CID } from 'multiformats/cid';

// Configure paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.DEBUG_PORT || 3002;
const HELIA_SERVER = process.env.HELIA_SERVER || 'http://localhost:3001';
const DEBUG_DIR = path.join(__dirname, 'debug-output');

// Ensure debug directory exists
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

// Create express app for debugging
const app = express();
app.use(cors());

// Helper to log with timestamp
function logWithTime(message) {
  const now = new Date();
  console.log(`[${now.toISOString()}] ${message}`);
}

// Helper to fetch and save content from the Helia server
async function fetchAndSaveContent(url, outputPath) {
  try {
    logWithTime(`Fetching: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed with status: ${response.status}`);
    }
    
    // Create directory for output if needed
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // For text content like M3U8 files
    if (url.includes('.m3u8')) {
      const content = await response.text();
      fs.writeFileSync(outputPath, content);
      logWithTime(`Saved text content to: ${outputPath}`);
      return content;
    } 
    // For binary content like TS segments
    else {
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(buffer));
      logWithTime(`Saved binary content to: ${outputPath} (${buffer.byteLength} bytes)`);
      return buffer;
    }
  } catch (error) {
    logWithTime(`Error fetching and saving ${url}: ${error.message}`);
    throw error;
  }
}

// Parse an M3U8 file and extract variant paths or segment paths
function parseM3u8(content, isVariant = false) {
  const lines = content.split('\n');
  const paths = [];
  const metadata = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Extract custom BASE-URL directive
    if (line.startsWith('#EXT-X-BASE-URL:')) {
      metadata.baseUrl = line.substring('#EXT-X-BASE-URL:'.length);
      continue;
    }
    
    // For master playlists, get variant paths
    if (!isVariant && line.startsWith('#EXT-X-STREAM-INF:')) {
      if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
        paths.push(lines[i + 1].trim());
      }
      continue;
    }
    
    // For variant playlists, get segment paths
    if (isVariant && line.startsWith('#EXTINF:')) {
      if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
        paths.push(lines[i + 1].trim());
      }
      continue;
    }
  }
  
  return { paths, metadata };
}

// Analyze and fix an HLS playlist
async function analyzeAndFixPlaylist(cid) {
  try {
    logWithTime(`Analyzing HLS playlist with CID: ${cid}`);
    
    // Create a directory for this CID
    const cidDir = path.join(DEBUG_DIR, cid);
    if (!fs.existsSync(cidDir)) {
      fs.mkdirSync(cidDir, { recursive: true });
    }
    
    // 1. Fetch and save the master playlist
    const masterUrl = `${HELIA_SERVER}/ipfs/${cid}?filename=master.m3u8`;
    const masterPath = path.join(cidDir, 'master.m3u8');
    const masterContent = await fetchAndSaveContent(masterUrl, masterPath);
    
    // 2. Parse the master playlist
    const { paths: variantPaths, metadata } = parseM3u8(masterContent);
    logWithTime(`Found ${variantPaths.length} variant paths in master playlist`);
    
    // 3. Extract jobId from metadata if available, or try to infer it
    let jobId = null;
    if (metadata.baseUrl) {
      const urlParts = metadata.baseUrl.split('/');
      // The format is typically http://hostname/hls/{jobId}/
      jobId = urlParts[urlParts.length - 2];
      logWithTime(`Extracted job ID from BASE-URL: ${jobId}`);
    } else {
      logWithTime(`No BASE-URL directive found in master playlist`);
    }
    
    // 4. Try to fetch variant playlists
    let foundValidVariant = false;
    for (const variantPath of variantPaths) {
      try {
        let variantUrl;
        if (jobId) {
          // If we have a jobId, construct the URL for direct server access
          variantUrl = `${HELIA_SERVER}/hls/${jobId}/${variantPath}`;
        } else {
          // Otherwise try relative URL resolution - this may not work
          variantUrl = `${HELIA_SERVER}/ipfs/${cid}/${variantPath}`;
        }
        
        const variantOutputPath = path.join(cidDir, variantPath);
        const variantContent = await fetchAndSaveContent(variantUrl, variantOutputPath);
        
        // 5. Parse the variant playlist to get segment paths
        const { paths: segmentPaths } = parseM3u8(variantContent, true);
        logWithTime(`Found ${segmentPaths.length} segment paths in variant playlist: ${variantPath}`);
        
        if (segmentPaths.length > 0) {
          foundValidVariant = true;
          
          // 6. Try to fetch the first segment
          try {
            const segmentPath = segmentPaths[0];
            const variantDir = path.dirname(variantPath);
            
            let segmentUrl;
            if (jobId) {
              segmentUrl = `${HELIA_SERVER}/hls/${jobId}/${variantDir}/${segmentPath}`;
            } else {
              segmentUrl = `${HELIA_SERVER}/ipfs/${cid}/${variantDir}/${segmentPath}`;
            }
            
            const segmentOutputPath = path.join(cidDir, variantDir, segmentPath);
            await fetchAndSaveContent(segmentUrl, segmentOutputPath);
            logWithTime(`Successfully fetched segment: ${segmentPath}`);
          } catch (segmentError) {
            logWithTime(`Error fetching segment: ${segmentError.message}`);
          }
        }
      } catch (variantError) {
        logWithTime(`Error processing variant ${variantPath}: ${variantError.message}`);
      }
    }
    
    // 7. Create a fixed master playlist if necessary
    if (!metadata.baseUrl && jobId) {
      const fixedMasterContent = masterContent.replace(
        '#EXTM3U\n#EXT-X-VERSION:3\n',
        `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-BASE-URL:${HELIA_SERVER}/hls/${jobId}/\n`
      );
      
      const fixedMasterPath = path.join(cidDir, 'fixed-master.m3u8');
      fs.writeFileSync(fixedMasterPath, fixedMasterContent);
      logWithTime(`Created fixed master playlist with BASE-URL directive: ${fixedMasterPath}`);
    }
    
    return {
      success: foundValidVariant,
      jobId,
      variantPaths,
      debugDir: cidDir,
    };
  } catch (error) {
    logWithTime(`Analysis failed: ${error.message}`);
    throw error;
  }
}

// Debug route handler - debug a specific CID
app.get('/debug/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    
    // Validate CID format
    try {
      CID.parse(cid);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid CID format' });
    }
    
    // Run the analyzer
    const result = await analyzeAndFixPlaylist(cid);
    
    res.json({
      success: true,
      analyzed: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a debug player to test HLS playback
app.get('/player/:cid', (req, res) => {
  const { cid } = req.params;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>HLS Debug Player</title>
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
      <h1>HLS Debug Player</h1>
      <p>Testing CID: <strong>${cid}</strong></p>
      
      <div>
        <button class="button" id="loadDirectIPFS">1. Load Direct IPFS URL</button>
        <button class="button" id="loadFixedHLS">2. Load with Fixed BASE-URL</button>
        <input type="text" id="customUrl" placeholder="Enter custom URL" style="padding: 8px; width: 300px;" />
        <button class="button" id="loadCustom">3. Load Custom URL</button>
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
        const cid = '${cid}';
        const heliaServer = '${HELIA_SERVER}';
        
        function writeLog(message, isError = false) {
          const item = document.createElement('div');
          item.textContent = message;
          item.className = isError ? 'error' : '';
          log.prepend(item);
        }
        
        function writeSuccess(message) {
          const item = document.createElement('div');
          item.textContent = '✅ ' + message;
          item.className = 'success';
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
              xhrSetup: function(xhr, hlsUrl) {
                writeLog('XHR request: ' + hlsUrl);
              }
            });
            
            hls.on(Hls.Events.ERROR, function(event, data) {
              writeLog('HLS Error: ' + data.details, true);
              console.error('HLS error:', data);
              
              if (data.fatal) {
                switch(data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    writeLog('Fatal network error...trying to recover', true);
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    writeLog('Fatal media error...trying to recover', true);
                    hls.recoverMediaError();
                    break;
                  default:
                    writeLog('Fatal error, cannot recover', true);
                    hls.destroy();
                    break;
                }
              }
            });
            
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
              writeSuccess('HLS manifest parsed successfully!');
              writeLog('Available quality levels: ' + hls.levels.length);
              video.play();
            });
            
            hls.on(Hls.Events.LEVEL_LOADED, function(event, data) {
              writeSuccess('Quality level loaded: ' + data.level);
            });
            
            hls.loadSource(url);
            hls.attachMedia(video);
            window.hls = hls;
            
            writeLog('Using HLS.js for playback');
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // For Safari with native HLS support
            video.src = url;
            writeLog('Using native HLS support');
          } else {
            writeLog('HLS is not supported in this browser', true);
          }
        }
        
        // Direct IPFS URL
        document.getElementById('loadDirectIPFS').addEventListener('click', function() {
          const url = heliaServer + '/ipfs/' + cid + '?filename=master.m3u8';
          writeLog('Loading direct IPFS URL: ' + url);
          loadHLS(url);
        });
        
        // Fixed HLS URL
        document.getElementById('loadFixedHLS').addEventListener('click', function() {
          // Fetch the debug info to get jobId
          fetch('/debug/' + cid)
            .then(response => response.json())
            .then(data => {
              if (data.success && data.jobId) {
                const fixedUrl = heliaServer + '/hls/' + data.jobId + '/master.m3u8';
                writeLog('Loading fixed HLS URL with job ID: ' + data.jobId);
                loadHLS(fixedUrl);
              } else {
                writeLog('Could not determine jobId for fixed URL', true);
              }
            })
            .catch(err => {
              writeLog('Error fetching debug info: ' + err.message, true);
            });
        });
        
        // Custom URL
        document.getElementById('loadCustom').addEventListener('click', function() {
          const customUrl = document.getElementById('customUrl').value.trim();
          if (customUrl) {
            writeLog('Loading custom URL: ' + customUrl);
            loadHLS(customUrl);
          } else {
            writeLog('Please enter a custom URL', true);
          }
        });
        
        // Initial log message
        writeLog('HLS Debug Player initialized for CID: ' + cid);
      </script>
    </body>
    </html>
  `);
});

// Serve files from the debug directory
app.use('/files', express.static(DEBUG_DIR));

// Home page with instructions
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>HLS Debugging Tool</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        pre { background: #f4f4f4; padding: 10px; overflow: auto; }
        input, button { padding: 8px; margin: 5px 0; }
        button { background: #4CAF50; color: white; border: none; cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>HLS Debugging Tool</h1>
      <p>This tool helps diagnose issues with HLS video streaming.</p>
      
      <h2>Usage:</h2>
      <ul>
        <li><strong>Debug a CID:</strong> /debug/{cid}</li>
        <li><strong>Test player:</strong> /player/{cid}</li>
      </ul>
      
      <h2>Try it:</h2>
      <input type="text" id="cidInput" placeholder="Enter IPFS CID" style="width: 300px;"/>
      <button onclick="debug()">Debug</button>
      <button onclick="play()">Test Player</button>
      
      <script>
        function debug() {
          const cid = document.getElementById('cidInput').value.trim();
          if (cid) {
            window.location.href = '/debug/' + cid;
          } else {
            alert('Please enter a CID');
          }
        }
        
        function play() {
          const cid = document.getElementById('cidInput').value.trim();
          if (cid) {
            window.location.href = '/player/' + cid;
          } else {
            alert('Please enter a CID');
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  logWithTime(`HLS debug server running at http://localhost:${PORT}`);
});