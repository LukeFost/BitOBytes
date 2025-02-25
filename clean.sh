#!/bin/bash

# Clean up script for BitOBytes project

echo "Cleaning up BitOBytes..."

# Stop the dfx replica if it's running
dfx stop

# Remove .dfx directory
rm -rf .dfx

# Clean up frontend build artifacts
cd src/bitobytes_frontend
npm run clean
cd ../..

# Remove dist directory
rm -rf dist

echo "Cleanup complete! You can now run setup.sh to start fresh."
