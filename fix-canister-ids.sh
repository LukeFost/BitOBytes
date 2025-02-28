#!/bin/bash
# Quick fix script for canister ID environment variables

set -e

# Color codes for formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Fixing canister ID environment variables...${NC}"

# Check if local IC replica is running
if ! dfx ping &> /dev/null; then
  echo -e "${RED}Local IC replica is not running. Starting it...${NC}"
  dfx start --clean --background
  sleep 5
fi

# Get canister IDs
BACKEND_ID=$(dfx canister id bitobytes_backend 2>/dev/null || echo "")
SIWE_ID=$(dfx canister id ic_siwe_provider 2>/dev/null || echo "")

if [ -z "$BACKEND_ID" ] || [ -z "$SIWE_ID" ]; then
  echo -e "${RED}One or more canisters are not deployed. Deploying now...${NC}"
  dfx deploy
  
  # Get canister IDs again after deployment
  BACKEND_ID=$(dfx canister id bitobytes_backend)
  SIWE_ID=$(dfx canister id ic_siwe_provider)
fi

# Create or update .env.local
echo -e "${GREEN}Creating/updating .env.local file...${NC}"
echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$SIWE_ID" > src/bitobytes_frontend/.env.local
echo "NEXT_PUBLIC_BACKEND_CANISTER_ID=$BACKEND_ID" >> src/bitobytes_frontend/.env.local
echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> src/bitobytes_frontend/.env.local

echo -e "${GREEN}Environment variables configured:${NC}"
echo -e "  NEXT_PUBLIC_SIWE_CANISTER_ID=$SIWE_ID"
echo -e "  NEXT_PUBLIC_BACKEND_CANISTER_ID=$BACKEND_ID"
echo -e "  NEXT_PUBLIC_IC_HOST=http://localhost:4943"

echo -e "${YELLOW}Restarting Next.js development server...${NC}"
cd src/bitobytes_frontend
npm run dev &

echo -e "${GREEN}Fix complete! Access your application at http://localhost:3000${NC}"
echo -e "${YELLOW}Note: You may need to clear your browser cache or use incognito mode${NC}"