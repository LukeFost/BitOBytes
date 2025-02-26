#!/bin/bash

# Navigate to frontend directory
cd src/bitobytes_frontend

# Update ic-siwe-js to the latest version
npm install ic-siwe-js@latest

# Update related IC libraries to ensure compatibility
npm install @dfinity/agent@latest @dfinity/identity@latest @dfinity/candid@latest

# Clean npm cache
npm cache clean --force

# Reinstall all dependencies to ensure proper resolution
npm install

echo "Dependencies updated successfully!"
