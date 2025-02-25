#!/bin/bash

# A simple script to set up the BitOBytes project

echo "Setting up BitOBytes..."

# Create necessary directories
mkdir -p dist

# Check if dfx is installed
if ! command -v dfx &> /dev/null
then
    echo "dfx could not be found. Please install the DFINITY SDK first:"
    echo "sh -ci \"$(curl -fsSL https://sdk.dfinity.org/install.sh)\""
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "Node.js could not be found. Please install Node.js (v14+) first."
    exit 1
fi

# Start the local replica if not already running
if ! dfx ping &> /dev/null
then
    echo "Starting the local Internet Computer replica..."
    dfx start --clean --background
fi

# Deploy the canisters
echo "Deploying canisters to the local replica..."
dfx deploy

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd src/bitobytes_frontend
npm install

# Generate canister interface bindings
echo "Generating canister interface bindings..."
cd ../..
dfx generate

echo "Setup complete! To start the frontend development server:"
echo "cd src/bitobytes_frontend && npm run dev"
echo "Then visit: http://localhost:3000"
