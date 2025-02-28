#!/bin/bash
# BitOBytes Setup Script
# Comprehensive setup script for BitOBytes project with SIWE integration

set -e

# Color codes for formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Make all scripts executable
chmod +x *.sh

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

# Check for dfx
if ! command -v dfx &> /dev/null; then
    echo -e "${RED}dfx not found. Please install the DFINITY SDK:${NC}"
    echo "sh -ci \"\$(curl -fsSL https://internetcomputer.org/install.sh)\""
    exit 1
fi

# Check dfx version
DFX_VERSION=$(dfx --version | cut -d' ' -f2)
echo -e "${GREEN}dfx version: ${DFX_VERSION}${NC}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Please install Node.js v14 or later.${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}Node.js version: ${NODE_VERSION}${NC}"

# Start local IC replica if not already running
if ! dfx ping &> /dev/null; then
    echo -e "${YELLOW}Starting local IC replica...${NC}"
    dfx start --clean --background
    echo -e "${GREEN}Local IC replica started.${NC}"
else
    echo -e "${GREEN}Local IC replica is already running.${NC}"
fi

# Setup SIWE provider
echo -e "${YELLOW}Setting up SIWE provider...${NC}"

# For local development
DOMAIN="localhost:3000"
URI="http://localhost:3000"
CANISTER_NAME="ic_siwe_provider"

# Create the SIWE provider canister
echo "Creating SIWE provider canister..."
dfx canister create $CANISTER_NAME

# Get the canister ID
CANISTER_ID=$(dfx canister id $CANISTER_NAME)
echo -e "${GREEN}SIWE provider canister ID: ${CANISTER_ID}${NC}"

# Deploy the SIWE provider canister
echo "Deploying SIWE provider canister..."
dfx deploy $CANISTER_NAME --argument="(record { 
    domain = \"${DOMAIN}\"; 
    uri = \"${URI}\";
    statement = \"Sign in with Ethereum to BitOBytes\";
    chain_id = 1;
    session_expiration_time = 604800;
    signature_expiration_time = 300;
    version = \"1\";
    nonce_cache_slots = 8;
    nonce_expiration_time = 600;
})"

# Update environment variables for frontend
cd src/bitobytes_frontend

# Get backend canister ID
BACKEND_CANISTER_ID=$(dfx canister id bitobytes_backend)

# Create or update .env.local
echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID" > .env.local
echo "NEXT_PUBLIC_BACKEND_CANISTER_ID=$BACKEND_CANISTER_ID" >> .env.local
echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> .env.local

echo -e "${GREEN}Environment variables configured:${NC}"
echo -e "${GREEN}SIWE Canister ID: ${CANISTER_ID}${NC}"
echo -e "${GREEN}Backend Canister ID: ${BACKEND_CANISTER_ID}${NC}"

# Install frontend dependencies
echo -e "${YELLOW}Installing frontend dependencies...${NC}"
npm install
echo -e "${GREEN}Frontend dependencies installed.${NC}"

# Generate canister bindings
cd ../..
echo -e "${YELLOW}Generating canister bindings...${NC}"
dfx generate
echo -e "${GREEN}Canister bindings generated.${NC}"

# Deploy backend canister
echo -e "${YELLOW}Deploying backend canister...${NC}"
dfx deploy bitobytes_backend
echo -e "${GREEN}Backend canister deployed.${NC}"

# Validate the setup
echo -e "${YELLOW}Validating setup...${NC}"

# Check SIWE canister status
echo "Checking SIWE canister status..."
if dfx canister info $CANISTER_ID &> /dev/null; then
    echo -e "${GREEN}SIWE canister is installed and accessible.${NC}"
else
    echo -e "${RED}SIWE canister is not accessible.${NC}"
    exit 1
fi

# Test SIWE version
echo "Testing SIWE provider version..."
VERSION=$(dfx canister call $CANISTER_ID version)
echo -e "${GREEN}SIWE provider version: ${VERSION}${NC}"

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${YELLOW}To start the frontend:${NC}"
echo -e "cd src/bitobytes_frontend && npm run dev"
echo -e "${YELLOW}Then open your browser to:${NC} http://localhost:3000"