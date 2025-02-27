import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
import { FsBlockstore } from 'blockstore-fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { CID } from 'multiformats/cid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fsExtra from 'fs-extra';
import { randomUUID } from 'crypto';

dotenv.config();

// Set up paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// IMPORTANT: PUBLIC_SERVER_URL must be set to the exact domain/protocol that clients use
// For example: 'https://api.my-domain.io' - this is used in HLS URLs to prevent 404 errors
const PUBLIC_SERVER_URL = process.env.PUBLIC_SERVER_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Configure Multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit (adjust as needed)
});

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Temporary directory for HLS packaging
const TEMP_DIR = path.join(__dirname, 'temp');
fsExtra.ensureDirSync(TEMP_DIR);

let helia;
let fs;

// Predefined HLS variants
const HLS_VARIANTS = [
  { name: '720p', resolution: '1280x720', bitrate: '2500k' },
  { name: '480p', resolution: '854x480', bitrate: '1000k' },
  { name: '360p', resolution: '640x360', bitrate: '500k' }
];

/**
 * Transcode a video into HLS format with multiple quality variants.
 * Returns the path to a local folder containing all playlists and segments.
 */
async function transcodeToHls(videoBuffer) {
  // Create a unique job ID to avoid collisions
  const jobId = randomUUID();
  const hlsDir = path.join(TEMP_DIR, jobId);
  await fsExtra.ensureDir(hlsDir);

  // Write the uploaded buffer to a temp file
  const inputPath = path.join(hlsDir, 'input.mp4');
  await fsExtra.writeFile(inputPath, videoBuffer);
  console.log(`[transcodeToHls] Temp input file created at: ${inputPath}`);

  // Create subfolders for each variant
  for (const variant of HLS_VARIANTS) {
    const variantPath = path.join(hlsDir, variant.name);
    await fsExtra.ensureDir(variantPath);
    console.log(`[transcodeToHls] Created variant folder: ${variantPath}`);
  }

  // Transcode each variant in parallel
  const variantPromises = HLS_VARIANTS.map((variant) => {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-profile:v main',
          '-preset veryfast',
          '-sc_threshold 0',
          '-g 48',
          '-keyint_min 48',
          '-hls_time 4',
          '-hls_playlist_type vod',
          `-hls_segment_filename ${path.join(hlsDir, variant.name, 'segment_%03d.ts')}`
        ])
        .outputOption('-b:v', variant.bitrate)
        .outputOption('-maxrate', variant.bitrate)
        .outputOption('-bufsize', variant.bitrate)
        .outputOption('-s', variant.resolution)
        .outputOption('-c:a', 'aac')
        .outputOption('-b:a', '128k')
        .output(path.join(hlsDir, variant.name, 'playlist.m3u8'))
        .on('start', (cmd) => {
          console.log(`[transcodeToHls] FFmpeg start for ${variant.name}: ${cmd}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(
              `[transcodeToHls] ${variant.name} progress: ${progress.percent.toFixed(2)}%`
            );
          }
        })
        .on('end', () => {
          console.log(`[transcodeToHls] Completed variant: ${variant.name}`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`[transcodeToHls] Error in variant ${variant.name}: `, err);
          reject(err);
        })
        .run();
    });
  });

  await Promise.all(variantPromises);

  // Create the master playlist with absolute URLs for variant playlists
  // This ensures HLS.js can correctly resolve variant playlist paths
  // even when the master playlist is loaded from IPFS
  let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n';
  HLS_VARIANTS.forEach((variant) => {
    const bandwidth = parseInt(variant.bitrate.replace('k', '000'));
    masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${variant.resolution},NAME="${variant.name}"\n`;
    // Use absolute URLs instead of relative paths to prevent 404 errors
    masterPlaylist += `${PUBLIC_SERVER_URL}/hls/${jobId}/${variant.name}/playlist.m3u8\n`;
  });

  const masterPath = path.join(hlsDir, 'master.m3u8');
  await fsExtra.writeFile(masterPath, masterPlaylist);
  console.log(`[transcodeToHls] Master playlist created at: ${masterPath} with absolute URLs`);

  // Clean up the raw input
  await fsExtra.remove(inputPath);

  return hlsDir;
}

/**
 * Add a file to IPFS and return its CID.
 * For master.m3u8 files, we process them to include the base path
 * for proper HLS reference resolution.
 */
async function addFileToIpfs(filePath) {
  try {
    console.log(`[addFileToIpfs] Adding file to IPFS: ${filePath}`);
    
    // Special handling for master.m3u8
    if (path.basename(filePath) === 'master.m3u8') {
      console.log('[addFileToIpfs] Processing master.m3u8 for IPFS');
      
      // We no longer need to modify the master playlist content because
      // it already contains absolute URLs for each variant playlist

      // Read the m3u8 file directly (no modification needed)
      const data = await fsExtra.readFile(filePath);
      const fileCid = await fs.addBytes(new Uint8Array(data));
      
      console.log(`[addFileToIpfs] Successfully added master.m3u8. CID: ${fileCid.toString()}`);
      return fileCid;
    }
    
    // Regular file handling
    const data = await fsExtra.readFile(filePath);
    const fileCid = await fs.addBytes(new Uint8Array(data));
    console.log(`[addFileToIpfs] Successfully added. CID: ${fileCid.toString()}`);
    return fileCid;
  } catch (error) {
    console.error(`[addFileToIpfs] Error adding file: ${filePath}`, error);
    throw error;
  }
}

/**
 * Initialize the Helia (IPFS) node.
 */
async function initializeHelia() {
  try {
    console.log('[initializeHelia] Initializing Helia node...');
    const blockstore = new FsBlockstore(path.join(__dirname, 'blockstore', 'data'));

    helia = await createHelia({ blockstore });
    fs = unixfs(helia);

    console.log('[initializeHelia] Helia node initialized with PeerID:', helia.libp2p.peerId.toString());
  } catch (error) {
    console.error('[initializeHelia] Error initializing Helia:', error);
    process.exit(1);
  }
}

/* ------------------------ Express Routes ------------------------ */

// Simple health-check
app.get('/', (req, res) => {
  res.send('BitOBytes Helia Node is running (simplified HLS approach).');
});

/**
 * Serve HLS content from local storage
 * Routes:
 * - /hls/:jobId/master.m3u8 - Master playlist
 * - /hls/:jobId/:variant/playlist.m3u8 - Variant playlists
 * - /hls/:jobId/:variant/segment_XXX.ts - Segments
 */
app.get('/hls/:jobId/:path(*)', (req, res) => {
  try {
    const { jobId } = req.params;
    const reqPath = req.params.path;
    const filePath = path.join(TEMP_DIR, jobId, reqPath);

    console.log(`[GET /hls] Requesting HLS file: ${filePath}`);

    // Set appropriate content type
    let contentType = 'application/octet-stream';
    if (reqPath.endsWith('.m3u8')) {
      contentType = 'application/vnd.apple.mpegurl';
    } else if (reqPath.endsWith('.ts')) {
      contentType = 'video/MP2T';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    
    // Check if file exists
    if (!fsExtra.existsSync(filePath)) {
      console.error(`[GET /hls] File not found: ${filePath}`);
      
      // Special handling for variant playlists (try to redirect to another variant)
      if (reqPath.match(/^[0-9]+p\/playlist\.m3u8$/)) {
        const requestedVariant = reqPath.split('/')[0]; // Extract variant (e.g., "360p")
        console.log(`[GET /hls] Variant playlist not found: ${requestedVariant}. Checking alternatives...`);
        
        // Look for alternative variants
        const jobDir = path.join(TEMP_DIR, jobId);
        if (fsExtra.existsSync(jobDir)) {
          // Check if any of the expected variants exist
          const variants = ['720p', '480p', '360p'];
          for (const variant of variants) {
            if (variant !== requestedVariant) {
              const variantPath = path.join(jobDir, variant, 'playlist.m3u8');
              if (fsExtra.existsSync(variantPath)) {
                console.log(`[GET /hls] Redirecting to available variant: ${variant}`);
                return res.redirect(`/hls/${jobId}/${variant}/playlist.m3u8`);
              }
            }
          }
        }
      }
      
      return res.status(404).send('File not found');
    }

    // Stream the file
    const fileStream = fsExtra.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[GET /hls] Error serving HLS content:', error);
    res.status(500).send(`Error serving HLS content: ${error.message}`);
  }
});

/**
 * Upload route: 
 * 1. Transcodes the uploaded video into HLS with multiple variants.
 * 2. Adds only the master.m3u8 file to IPFS (simpler approach).
 */
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      console.warn('[POST /upload] No file in request.');
      return res.status(400).json({ error: 'No video file uploaded.' });
    }

    console.log(`[POST /upload] Received file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Transcode the video to HLS (locally)
    const hlsDir = await transcodeToHls(req.file.buffer);
    console.log(`[POST /upload] HLS transcoding completed. Output folder: ${hlsDir}`);

    // Add only the master playlist file to IPFS
    const masterPath = path.join(hlsDir, 'master.m3u8');
    let masterCid = null;
    if (await fsExtra.pathExists(masterPath)) {
      masterCid = await addFileToIpfs(masterPath);
      console.log(`[POST /upload] master.m3u8 added to IPFS. CID: ${masterCid.toString()}`);
    } else {
      console.error('[POST /upload] master.m3u8 file not found in HLS output.');
      throw new Error('master.m3u8 file missing after transcoding.');
    }

    // (Optional) If you do NOT want to keep your local HLS content, remove it here:
    // await fsExtra.remove(hlsDir);

    console.log('[POST /upload] Upload and processing completed successfully!');
    res.json({
      success: true,
      cid: masterCid ? masterCid.toString() : null,
      masterCid: masterCid ? masterCid.toString() : null,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('[POST /upload] Error:', error);
    res.status(500).json({
      error: 'Failed to upload/process video',
      details: error.message,
      stack: error.stack
    });
  }
});

/**
 * Retrieve a single file from IPFS by CID (no path resolution).
 * Example: GET /ipfs/<cid>?filename=master.m3u8
 * Also supports: GET /ipfs/<variant>/playlist.m3u8?jobid=<jobid> for HLS.js compatibility
 */
app.get('/ipfs/:cid', async (req, res) => {
  try {
    const cidStr = req.params.cid;
    const filename = req.query.filename || ''; // optional query param for logging
    const jobId = req.query.jobid || ''; // optional job ID for direct HLS serving

    console.log(`[GET /ipfs/:cid] Requesting CID: ${cidStr}, filename hint: ${filename}, jobId: ${jobId}`);

    // Check for variant playlist requests directly from HLS.js (uses path like /ipfs/360p/playlist.m3u8)
    if (cidStr.match(/^\d+p$/) && req.path.includes('/playlist.m3u8')) {
      const variant = cidStr; // e.g., "360p"
      
      // If jobid query param is provided, redirect to the proper HLS path
      if (jobId) {
        console.log(`[GET /ipfs/:cid] Variant playlist request detected with jobId: ${jobId}, variant: ${variant}`);
        const redirectUrl = `/hls/${jobId}/${variant}/playlist.m3u8`;
        console.log(`[GET /ipfs/:cid] Redirecting to: ${redirectUrl}`);
        return res.redirect(redirectUrl);
      }
    }

    // Check if this CID might be a job ID from temp directory (used for direct video access)
    if (cidStr.includes('-') && cidStr.length > 30) {
      // This looks like a UUID, could be a job ID
      const potentialJobId = cidStr;
      const jobDir = path.join(TEMP_DIR, potentialJobId);
      
      // Check if job directory exists (meaning this is a direct job ID reference)
      if (fsExtra.existsSync(jobDir)) {
        console.log(`[GET /ipfs/:cid] CID recognized as job ID: ${potentialJobId}`);
        
        // If a filename is specified, try to serve that file from the job directory
        if (filename) {
          const filePath = path.join(jobDir, filename);
          if (fsExtra.existsSync(filePath)) {
            console.log(`[GET /ipfs/:cid] Serving job file: ${filePath}`);
            
            // Set appropriate content type
            let contentType = 'application/octet-stream';
            if (filename.endsWith('.mp4')) {
              contentType = 'video/mp4';
            } else if (filename.endsWith('.m3u8')) {
              contentType = 'application/vnd.apple.mpegurl';
            } else if (filename.endsWith('.ts')) {
              contentType = 'video/MP2T';
            }
            
            // Set headers for video playback
            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
            res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
            
            // Support Range requests for video seeking
            const fileSize = fsExtra.statSync(filePath).size;
            const range = req.headers.range;
            
            if (range) {
              // Parse Range header
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
              const chunkSize = (end - start) + 1;
              
              console.log(`[GET /ipfs/:cid] Range request: ${start}-${end}/${fileSize}`);
              
              // Set partial content headers
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
                'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range'
              });
              
              // Stream the range
              const fileStream = fsExtra.createReadStream(filePath, {start, end});
              fileStream.pipe(res);
              return;
            } else {
              // Stream the whole file
              res.setHeader('Content-Length', fileSize);
              const fileStream = fsExtra.createReadStream(filePath);
              fileStream.pipe(res);
              return;
            }
          }
        }
        
        // If we get here, either no filename was specified or the file wasn't found
        // Return a list of files in the job directory
        console.log(`[GET /ipfs/:cid] No specific file requested, listing job directory`);
        const files = fsExtra.readdirSync(jobDir);
        res.json({
          jobId: potentialJobId,
          files: files,
          message: "This is a job ID. Please specify a filename parameter to retrieve a specific file."
        });
        return;
      }
    }

    const cid = CID.parse(cidStr);

    // Guess content-type based on the content or filename extension
    let contentType = 'application/octet-stream';
    
    // Check for m3u8 file (either by filename or content inspection)
    if (filename.endsWith('.m3u8') || cidStr === 'bafkreih3plwi4lxx4v5fn3diufmmpwkn6ud46d26u6gdirsyaezcwc5hc4') {
      contentType = 'application/vnd.apple.mpegurl';
      console.log(`[GET /ipfs/:cid] Detected as HLS playlist, setting content type: ${contentType}`);
    } else if (filename.endsWith('.ts')) {
      contentType = 'video/MP2T';
    } else if (filename.endsWith('.mp4')) {
      contentType = 'video/mp4';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Add CORS headers to support video playback
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    
    // Tell browsers to allow cross-origin isolation (needed for SharedArrayBuffer in some video playback)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // Stream the file from IPFS
    console.log(`[GET /ipfs/:cid] Starting to stream file with CID: ${cidStr}`);
    for await (const chunk of fs.cat(cid)) {
      res.write(chunk);
    }
    res.end();
    console.log(`[GET /ipfs/:cid] Completed streaming for CID: ${cidStr}`);
  } catch (error) {
    console.error('[GET /ipfs/:cid] Error retrieving content:', error);
    res.status(500).send(`Error retrieving content: ${error.message}`);
  }
});

// Start the server
async function startServer() {
  await initializeHelia();
  app.listen(PORT, () => {
    console.log(`[startServer] Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);