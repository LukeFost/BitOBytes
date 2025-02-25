#!/bin/bash

# A script to deploy the BitOBytes project

echo "Preparing for deployment..."

# Create necessary directories
mkdir -p dist/bitobytes_frontend

# Build and export the frontend
cd src/bitobytes_frontend
npm run build
# Copy the exported files to the dist directory
mkdir -p ../../dist/bitobytes_frontend
rm -rf ../../dist/bitobytes_frontend/*
cp -r dist/* ../../dist/bitobytes_frontend/
cd ../..

# Deploy to local replica
echo "Deploying to local replica..."
dfx deploy

echo "Deployment complete!"
echo "Visit http://localhost:8000?canisterId=$(dfx canister id bitobytes_frontend) to view your application"
