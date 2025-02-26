#!/bin/bash

# Exit on error
set -e

echo "Resetting SIWE environment and redeploying canister..."

# Stop any running dfx instances
echo "Stopping any running dfx instances..."
dfx stop || true

# Clear .dfx directory for the SIWE provider
echo "Clearing .dfx directory for SIWE provider..."
rm -rf .dfx/local/canisters/ic_siwe_provider

# Clear browser storage data (instruction for user)
echo "IMPORTANT: Please clear your browser's local storage to remove any cached SIWE data."
echo "In Chrome/Edge: DevTools > Application > Storage > Clear site data"
echo "In Firefox: DevTools > Storage > Local Storage > Right click > Delete All"

# Start dfx
echo "Starting dfx..."
dfx start --clean --background

# Deploy the SIWE provider with proper arguments
echo "Deploying SIWE provider canister..."
./deploy-rust-siwe.sh

echo "SIWE provider deployed successfully!"
echo "Next steps:"
echo "1. Clear your browser's local storage"
echo "2. Navigate to the frontend directory: cd src/bitobytes_frontend"
echo "3. Start the development server: npm run dev"
echo "4. Open your browser at http://localhost:3000"
