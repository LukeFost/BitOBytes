// intercept-hls-requests.js - Debug script that intercepts and logs all HLS-related requests
// This script runs as a standalone HTTP server to diagnose HLS URL issues

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Configure paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.DEBUG_PORT || 3003;
const HELIA_SERVER = process.env.HELIA_SERVER || 'http://localhost:3001';
const DEBUG_DIR = path.join(__dirname, 'debug-output', 'intercept');

// Ensure debug directory exists
if (!fs.existsSync(DEBUG_DIR)) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

// Create express app
const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'Origin', 'X-Requested-With', 'Accept']
}));

// Use morgan for logging all requests
app.use(morgan('dev'));

// Helper to log with timestamp
function logWithTime(message) {
  const now = new Date();
  console.log(`[${now.toISOString()}] ${message}`);
  
  // Also append to debug log
  fs.appendFileSync(
    path.join(DEBUG_DIR, 'hls-requests.log'), 
    `[${now.toISOString()}] ${message}\n`
  );
}

// Special logger middleware to capture and log all requests
app.use((req, res, next) => {
  const { method, url, headers } = req;
  
  // Log basic request info
  logWithTime(`${method} ${url}`);
  
  // Log headers for HLS-related requests
  if (url.includes('.m3u8') || url.includes('.ts') || url.includes('/ipfs/')) {
    logWithTime(`Headers: ${JSON.stringify(headers)}`);
    
    // Save request details to JSON file for debugging
    const requestId = Date.now();
    const requestInfo = {
      id: requestId,
      timestamp: new Date().toISOString(),
      method,
      url,
      headers,
      query: req.query
    };
    
    fs.writeFileSync(
      path.join(DEBUG_DIR, `request-${requestId}.json`),
      JSON.stringify(requestInfo, null, 2)
    );
  }
  
  next();
});

// Intercept and fix HLS playlist requests
app.get('/ipfs/:pathParam(*)', async (req, res, next) => {
  const fullPath = req.params.pathParam;
  logWithTime(`Intercepted IPFS request: ${fullPath}`);
  
  // Check for variant playlist requests like /ipfs/360p/playlist.m3u8
  if (fullPath.match(/^(\d+p)\/playlist\.m3u8$/)) {
    const variant = fullPath.split('/')[0]; // e.g., "360p"
    const jobId = req.query.jobid;
    
    logWithTime(`Detected variant playlist request: ${variant}, jobId: ${jobId}`);
    
    if (jobId) {
      // This is a request for a specific variant with a known job ID
      const targetUrl = `${HELIA_SERVER}/hls/${jobId}/${variant}/playlist.m3u8`;
      logWithTime(`Redirecting to HLS endpoint: ${targetUrl}`);
      
      try {
        // Fetch the content ourselves and return it (avoids redirect issues)
        const response = await fetch(targetUrl);
        
        if (response.ok) {
          const content = await response.text();
          logWithTime(`Successfully fetched variant playlist from: ${targetUrl}`);
          
          // Send with proper HLS MIME type
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(content);
        } else {
          logWithTime(`Failed to fetch variant playlist: ${response.status} ${response.statusText}`);
          
          // Try to find alternative variant
          const alternativeVariants = ['720p', '480p', '360p'].filter(v => v !== variant);
          
          for (const altVariant of alternativeVariants) {
            const altUrl = `${HELIA_SERVER}/hls/${jobId}/${altVariant}/playlist.m3u8`;
            logWithTime(`Trying alternative variant: ${altUrl}`);
            
            const altResponse = await fetch(altUrl);
            if (altResponse.ok) {
              const content = await altResponse.text();
              logWithTime(`Found alternative variant: ${altVariant}`);
              
              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.send(content);
            }
          }
          
          // If we get here, we couldn't find any variant
          return res.status(404).send(`No available variant playlists for job ${jobId}`);
        }
      } catch (error) {
        logWithTime(`Error handling variant request: ${error.message}`);
        return res.status(500).send(`Error handling request: ${error.message}`);
      }
    }
  }
  
  // If we get here, proceed to standard proxy
  next();
});

// Handle normal master playlist requests
app.get('/ipfs/:cid', async (req, res, next) => {
  const { cid } = req.params;
  const { filename } = req.query;
  
  // Only intercept master playlist requests
  if (filename === 'master.m3u8') {
    logWithTime(`Intercepted master playlist request for CID: ${cid}`);
    
    try {
      // Fetch the master playlist from the IPFS server
      const response = await fetch(`${HELIA_SERVER}/ipfs/${cid}?filename=master.m3u8`);
      
      if (response.ok) {
        let content = await response.text();
        logWithTime(`Successfully fetched master playlist for CID: ${cid}`);
        
        // Extract job ID from master playlist (if it has EXT-X-BASE-URL)
        const jobIdMatch = content.match(/#EXT-X-BASE-URL:.*\/hls\/([^/]+)\//);
        const jobId = jobIdMatch ? jobIdMatch[1] : cid;
        
        logWithTime(`Extracted job ID from master playlist: ${jobId}`);
        
        // Modify the playlist to include the job ID in variant URLs
        // This helps HLS.js correctly request variant playlists
        content = content.replace(
          /^(\d+p\/playlist\.m3u8)$/gm,
          (match, p1) => `${p1}?jobid=${jobId}`
        );
        
        // Save the modified playlist for debugging
        fs.writeFileSync(
          path.join(DEBUG_DIR, `modified-master-${cid}.m3u8`),
          content
        );
        
        // Send the modified playlist
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(content);
      }
    } catch (error) {
      logWithTime(`Error handling master playlist: ${error.message}`);
    }
  }
  
  // If we get here, proceed to standard proxy
  next();
});

// Set up proxy to forward all other requests to the actual Helia server
app.use('/', createProxyMiddleware({
  target: HELIA_SERVER,
  changeOrigin: true,
  logLevel: 'debug',
  onProxyRes: (proxyRes, req, res) => {
    // Log proxy responses for debugging
    if (req.url.includes('.m3u8') || req.url.includes('.ts') || req.url.includes('/ipfs/')) {
      logWithTime(`Proxy response for ${req.method} ${req.url}: ${proxyRes.statusCode}`);
    }
    
    // Ensure CORS headers are set
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Range, Origin, X-Requested-With, Accept';
  }
}));

// Create a simple debug UI
app.get('/debug', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>HLS Request Interceptor Debug UI</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        pre { background: #f4f4f4; padding: 10px; overflow: auto; }
        h2 { margin-top: 30px; }
        .log { height: 300px; overflow: auto; background: #f8f8f8; padding: 10px; border: 1px solid #ddd; }
        .button { background: #4CAF50; color: white; border: none; padding: 8px 16px; cursor: pointer; margin: 5px; }
      </style>
    </head>
    <body>
      <h1>HLS Request Interceptor Debug UI</h1>
      <p>This service is intercepting and analyzing HLS requests at <strong>http://localhost:${PORT}</strong></p>
      
      <h2>Usage Instructions</h2>
      <ol>
        <li>Configure your frontend to use this server as the IPFS endpoint (instead of the actual Helia node)</li>
        <li>Play videos as normal and watch the logs below</li>
        <li>All requests will be forwarded to the real server at <strong>${HELIA_SERVER}</strong></li>
      </ol>
      
      <h2>Recent Requests</h2>
      <div class="log" id="requestLog">Loading...</div>
      
      <h2>Test HLS Playback</h2>
      <div>
        <input type="text" id="cidInput" placeholder="Enter CID or Job ID" style="padding: 8px; width: 300px;">
        <button class="button" onclick="testPlayback()">Test Playback</button>
      </div>
      
      <script>
        function loadLogs() {
          fetch('/debug/logs')
            .then(response => response.text())
            .then(text => {
              document.getElementById('requestLog').textContent = text;
              // Auto-scroll to bottom
              const logElement = document.getElementById('requestLog');
              logElement.scrollTop = logElement.scrollHeight;
            })
            .catch(err => {
              console.error('Error loading logs:', err);
            });
        }
        
        function testPlayback() {
          const cid = document.getElementById('cidInput').value.trim();
          if (cid) {
            window.open('/debug/player/' + cid, '_blank');
          } else {
            alert('Please enter a CID or Job ID');
          }
        }
        
        // Load logs initially and then every 2 seconds
        loadLogs();
        setInterval(loadLogs, 2000);
      </script>
    </body>
    </html>
  `);
});

// API endpoint to get the most recent logs
app.get('/debug/logs', (req, res) => {
  try {
    const logPath = path.join(DEBUG_DIR, 'hls-requests.log');
    
    if (fs.existsSync(logPath)) {
      // Read the last 100 lines
      const data = fs.readFileSync(logPath, 'utf8');
      const lines = data.split('\n');
      const lastLines = lines.slice(Math.max(0, lines.length - 100)).join('\n');
      
      res.setHeader('Content-Type', 'text/plain');
      res.send(lastLines);
    } else {
      res.send('No logs available yet');
    }
  } catch (error) {
    res.status(500).send(`Error reading logs: ${error.message}`);
  }
});

// Test player for specific CID
app.get('/debug/player/:cid', (req, res) => {
  const { cid } = req.params;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>HLS Debug Player - ${cid}</title>
      <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        video { width: 100%; margin: 20px 0; }
        pre { background: #f4f4f4; padding: 10px; overflow: auto; }
        .log { max-height: 300px; overflow-y: auto; margin-top: 20px; background: #f8f8f8; padding: 10px; border: 1px solid #ddd; }
        .error { color: red; }
        .success { color: green; }
        .button { background: #4CAF50; color: white; border: none; padding: 8px 16px; cursor: pointer; margin: 5px; }
      </style>
    </head>
    <body>
      <h1>HLS Debug Player</h1>
      <p>Testing CID/Job ID: <strong>${cid}</strong></p>
      
      <div>
        <button class="button" id="loadHLS">Load HLS</button>
        <button class="button" id="loadDirect">Load Direct Video</button>
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
        const baseUrl = window.location.protocol + '//' + window.location.host;
        
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
        
        function loadHLS() {
          // The URL is the intercepted URL, which will add jobid automatically if needed
          const hlsUrl = baseUrl + '/ipfs/' + cid + '?filename=master.m3u8';
          currentUrlDisplay.textContent = hlsUrl;
          
          if (Hls.isSupported()) {
            writeLog('HLS.js is supported in this browser');
            
            // Destroy existing HLS instance if it exists
            if (window.hls) {
              window.hls.destroy();
            }
            
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
              writeSuccess('HLS manifest parsed successfully!');
              writeLog('Available quality levels: ' + hls.levels.length);
              video.play();
            });
            
            writeLog('Loading HLS source: ' + hlsUrl);
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            window.hls = hls;
          } else {
            writeLog('HLS.js is not supported in this browser', true);
          }
        }
        
        function loadDirect() {
          // Try to load the video directly
          const directUrl = baseUrl + '/ipfs/' + cid + '?filename=video.mp4';
          currentUrlDisplay.textContent = directUrl;
          
          // Destroy existing HLS instance if it exists
          if (window.hls) {
            window.hls.destroy();
            window.hls = null;
          }
          
          writeLog('Loading direct video URL: ' + directUrl);
          video.src = directUrl;
          video.play();
        }
        
        // Set up event listeners
        document.getElementById('loadHLS').addEventListener('click', loadHLS);
        document.getElementById('loadDirect').addEventListener('click', loadDirect);
        
        // Load HLS by default
        loadHLS();
      </script>
    </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  logWithTime(`HLS Request Interceptor running at http://localhost:${PORT}`);
  logWithTime(`Proxying requests to ${HELIA_SERVER}`);
  logWithTime(`Debug UI available at http://localhost:${PORT}/debug`);
});