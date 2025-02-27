#!/bin/bash

# Check if server is running
if ! curl -s http://localhost:3001/ > /dev/null; then
  echo "Error: Helia server is not running. Please start it before running tests."
  echo "Try: 'node server.js' in the helia_node directory."
  exit 1
fi

# Detect input video file
DEFAULT_VIDEO="../../input.mp4"
if [ ! -f "$DEFAULT_VIDEO" ]; then
  echo "Warning: Default video file not found at $DEFAULT_VIDEO"
  echo "Please specify a video file path as the first argument"
  VIDEO_PATH="$1"
  if [ -z "$VIDEO_PATH" ] || [ ! -f "$VIDEO_PATH" ]; then
    echo "Error: No valid video file provided"
    exit 1
  fi
else
  VIDEO_PATH="$DEFAULT_VIDEO"
  if [ ! -z "$1" ]; then
    VIDEO_PATH="$1"
  fi
fi

echo "Using video file: $VIDEO_PATH"

# Create test output directory
mkdir -p output

# Run HLS tests
echo "========================================"
echo "Running HLS streaming tests..."
echo "========================================"
node test-hls.js "$VIDEO_PATH"
HLS_RESULT=$?

if [ $HLS_RESULT -ne 0 ]; then
  echo "HLS tests failed! Starting debug server to help troubleshoot..."
  echo "Start the debug server with: node ../tools/fix-hls-video-loading.js"
  echo "Then open http://localhost:3002/ in your browser"
  exit 1
fi

# Get the CID from the output
CID=$(cat output/master.m3u8 | grep -o "EXT-X-BASE-URL:.*" | cut -d'/' -f 5)
if [ -z "$CID" ]; then
  echo "Could not extract CID from master playlist. Using CID from command line if provided."
  CID="$2"
fi

if [ -z "$CID" ]; then
  echo "Error: No CID available for direct stream test. Please provide one as the second argument."
  exit 1
fi

# Run direct stream tests
echo "========================================"
echo "Running direct video streaming tests for CID: $CID"
echo "========================================"
node test-direct-stream.js "$CID"
DIRECT_RESULT=$?

if [ $DIRECT_RESULT -ne 0 ]; then
  echo "Direct streaming tests failed!"
  exit 1
fi

echo "========================================"
echo "All tests passed successfully!"
echo "========================================"
echo "Your video content is accessible via:"
echo "HLS: http://localhost:3001/ipfs/$CID?filename=master.m3u8"
echo "Direct: http://localhost:3001/ipfs/$CID?filename=video.mp4"
echo ""
echo "To diagnose frontend issues, try using the debug tool:"
echo "node ../tools/fix-hls-video-loading.js"
echo "Then open http://localhost:3002/player/$CID in your browser"