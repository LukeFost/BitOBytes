// fix-playlist-redirector.js - A simple proxy that handles variant playlist requests

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Configure paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PROXY_PORT || 3003;
const HELIA_SERVER = process.env.HELIA_SERVER || 'http://localhost:3001';
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// Create express app
const app = express();
app.use(cors());
app.use(morgan('dev'));

// Helper to log with timestamp
function logWithTime(message) {
  const now = new Date();
  console.log(`[${now.toISOString()}] ${message}`);
}

// List available variants for a job ID
function getAvailableVariants(jobId) {
  try {
    const jobDir = path.join(TEMP_DIR, jobId);
    if (!fs.existsSync(jobDir)) {
      return [];
    }
    
    return fs.readdirSync(jobDir)
      .filter(dir => {
        // Check if this is a variant directory with playlist.m3u8
        const variantDir = path.join(jobDir, dir);
        return fs.statSync(variantDir).isDirectory() && 
               fs.existsSync(path.join(variantDir, 'playlist.m3u8'));
      });
  } catch (error) {
    logWithTime(`Error getting variants: ${error.message}`);
    return [];
  }
}

// Custom middleware to handle 404 playlists
const playlistRedirector = (req, res, next) => {
  // Only handle specific paths that look like variant playlists
  if (req.url.match(/\/ipfs\/(\d+p)\/playlist\.m3u8$/)) {
    const variant = req.url.split('/')[2]; // e.g. "360p"
    logWithTime(`Intercepted variant playlist request: ${variant}`);
    
    // Get the actual master.m3u8 CID or jobID from query params
    const jobId = req.query.jobid || req.query.cid;
    if (!jobId) {
      logWithTime('No job ID or CID provided in query parameters');
      return res.status(400).send('Missing jobid or cid parameter');
    }
    
    logWithTime(`Looking for job ID: ${jobId}`);
    
    // Check if this job ID exists and has variants
    const variants = getAvailableVariants(jobId);
    if (variants.length === 0) {
      logWithTime(`No variants found for job ID: ${jobId}`);
      return next(); // Continue to the proxy
    }
    
    // If the requested variant exists, redirect to the actual HLS endpoint
    if (variants.includes(variant)) {
      const redirectUrl = `${HELIA_SERVER}/hls/${jobId}/${variant}/playlist.m3u8`;
      logWithTime(`Redirecting to: ${redirectUrl}`);
      return res.redirect(redirectUrl);
    }
    
    // If requested variant doesn't exist but others do, redirect to first available
    const alternativeVariant = variants[0];
    const redirectUrl = `${HELIA_SERVER}/hls/${jobId}/${alternativeVariant}/playlist.m3u8`;
    logWithTime(`Requested variant ${variant} not found. Redirecting to: ${redirectUrl}`);
    return res.redirect(redirectUrl);
  }
  
  // Not a variant playlist request, continue to proxy
  next();
};

// Apply custom middleware
app.use(playlistRedirector);

// Setup proxy to forward to the actual Helia server
app.use('/', createProxyMiddleware({
  target: HELIA_SERVER,
  changeOrigin: true,
  logLevel: 'debug'
}));

// Start the server
app.listen(PORT, () => {
  logWithTime(`Playlist redirector proxy running at http://localhost:${PORT}`);
  logWithTime(`Proxying requests to ${HELIA_SERVER}`);
  logWithTime(`Example usage: http://localhost:${PORT}/ipfs/360p/playlist.m3u8?jobid=<UUID>`);
});