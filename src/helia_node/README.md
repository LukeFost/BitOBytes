# BitOBytes Helia Node - HLS Troubleshooting Guide

This directory contains the Helia IPFS node with HLS video transcoding capabilities for BitOBytes.

## Directory Structure

```
src/helia_node/
├── README.md                 # Documentation
├── blockstore/               # IPFS block storage
├── server.js                 # Main Helia node server
├── temp/                     # Temporary storage for HLS content
├── tests/                    # Test utilities
│   ├── output/               # Test output directory
│   ├── run-tests.sh          # All-in-one test script
│   ├── test-direct-stream.js # Direct video streaming tests
│   └── test-hls.js           # HLS streaming tests
└── tools/                    # Utility tools
    └── fix-hls-video-loading.js  # Interactive debug server
```

## Testing Tools

Several testing utilities are provided to help diagnose issues with the HLS streaming implementation:

### 1. HLS Streaming Test

Tests the complete HLS pipeline from video upload to segment playback:

```bash
cd tests
node test-hls.js [path/to/video.mp4]
```

This tool:
- Uploads a test video to the Helia node
- Validates the master HLS playlist
- Checks variant playlists are accessible
- Verifies video segments can be fetched

### 2. Direct Video Stream Test

Tests direct video streaming from IPFS without HLS:

```bash
cd tests
node test-direct-stream.js [CID]
```

This tool:
- Tests direct video fetching from IPFS
- Verifies partial content (range) requests work
- Checks CORS headers are properly set
- Simulates video playback by requesting multiple chunks

### 3. HLS Debug Server

Interactive debugging tool for HLS playback issues:

```bash
cd tools
node fix-hls-video-loading.js
```

This starts a debug server on port 3002 with features:
- Debug any HLS content by CID
- Interactive test player with HLS.js
- Analyze and fix common HLS playlist issues
- Display detailed diagnostic information

Visit http://localhost:3002/ after starting the server.

### All-in-One Test Script

Run all tests with a single command:

```bash
cd tests
./run-tests.sh [path/to/video.mp4] [optional-CID]
```

## Test Results

The latest test run shows:

1. **HLS Streaming**: ✅ PASSED
   - Successfully uploads video to IPFS
   - Correctly transcodes to multiple HLS variants
   - Properly generates master and variant playlists
   - Successfully fetches HLS segments

2. **Direct Video Streaming**: ❌ FAILED
   - Issue with HEAD request status 500
   - This suggests the direct video streaming needs fixing
   - The HLS path works but direct IPFS file access has issues

## Troubleshooting Common Issues

### "Failed to load video" in Frontend

1. Make sure the Helia node is running: `node server.js`
2. Check CORS headers are correctly set
3. Verify the CID is valid and accessible via `/ipfs/{cid}`
4. Use the debug tools to test direct playback vs HLS

### HLS Playback Fails But Direct Video Works

1. Check for path resolution issues in the master playlist
2. Verify the BASE-URL directive is present in the master.m3u8
3. Use the debug player to test different playback methods

### Network Errors in Browser Console

1. Check the server logs for 404 errors
2. Use the debug server to analyze the playlist structure
3. Verify the job ID is correctly extracted and paths resolve

### No Video with "Playing original video" Message

This is the fallback mode when HLS fails. To fix the HLS implementation:
1. Use `test-hls.js` to verify server-side HLS generation
2. Check that playlists correctly reference segments
3. Verify browser console for specific HLS.js errors