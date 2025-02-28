#!/bin/bash
# BitOBytes Deployment Script
# Handles deployment to both local development and production environments

set -e

# Color codes for formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Default to local deployment
ENVIRONMENT="local"

# Parse command line arguments
if [ "$1" = "production" ] || [ "$1" = "ic" ]; then
    ENVIRONMENT="production"
    echo -e "${YELLOW}Preparing for production deployment...${NC}"
else
    echo -e "${YELLOW}Preparing for local deployment...${NC}"
fi

# Check if dfx is running for local deployment
if [ "$ENVIRONMENT" = "local" ]; then
    if ! dfx ping &> /dev/null; then
        echo -e "${RED}Local IC replica is not running. Start it with 'dfx start --clean --background'${NC}"
        exit 1
    fi
fi

# Configure environment-specific variables
if [ "$ENVIRONMENT" = "production" ]; then
    NETWORK="--network ic"
    DOMAIN="bitobytes.icp0.io" # Update with your production domain
    URI="https://bitobytes.icp0.io" # Update with your production URI
    IC_HOST="https://ic0.app"
else
    NETWORK=""
    DOMAIN="localhost:3000"
    URI="http://localhost:3000"
    IC_HOST="http://localhost:4943"
fi

# Deploy SIWE provider
echo -e "${YELLOW}Deploying SIWE provider...${NC}"
CANISTER_NAME="ic_siwe_provider"

# Create the SIWE provider canister if it doesn't exist
if ! dfx canister $NETWORK info $CANISTER_NAME &> /dev/null; then
    echo "Creating SIWE provider canister..."
    dfx canister $NETWORK create $CANISTER_NAME
fi

# Get the canister ID
CANISTER_ID=$(dfx canister $NETWORK id $CANISTER_NAME)
echo -e "${GREEN}SIWE provider canister ID: ${CANISTER_ID}${NC}"

# Deploy the SIWE provider canister
echo "Deploying SIWE provider canister..."
dfx deploy $NETWORK $CANISTER_NAME --argument="(record { 
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

# Create or update environment file
if [ "$ENVIRONMENT" = "production" ]; then
    # For production, update .env.production
    echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID" > .env.production
    echo "NEXT_PUBLIC_IC_HOST=$IC_HOST" >> .env.production
    ENV_FILE=".env.production"
else
    # For local, update .env.local
    echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID" > .env.local
    echo "NEXT_PUBLIC_IC_HOST=$IC_HOST" >> .env.local
    ENV_FILE=".env.local"
fi

echo -e "${GREEN}Updated environment variables in ${ENV_FILE}${NC}"

# Deploy backend canister
echo -e "${YELLOW}Deploying backend canister...${NC}"
cd ../..
dfx deploy $NETWORK bitobytes_backend
echo -e "${GREEN}Backend canister deployed.${NC}"

# Build and deploy frontend
echo -e "${YELLOW}Building frontend...${NC}"
cd src/bitobytes_frontend

if [ "$ENVIRONMENT" = "production" ]; then
    # Production build
    npm run build
else
    # Local build for development
    npm run build
fi

echo -e "${GREEN}Frontend built.${NC}"

# Deploy frontend assets
cd ../..
echo -e "${YELLOW}Deploying frontend...${NC}"
dfx deploy $NETWORK bitobytes_frontend
echo -e "${GREEN}Frontend deployed.${NC}"

# Display deployment information
if [ "$ENVIRONMENT" = "production" ]; then
    FRONTEND_CANISTER=$(dfx canister $NETWORK id bitobytes_frontend)
    echo -e "${GREEN}Deployment complete!${NC}"
    echo -e "${YELLOW}Frontend URL:${NC} https://${FRONTEND_CANISTER}.ic0.app/"
else
    echo -e "${GREEN}Local deployment complete!${NC}"
    echo -e "${YELLOW}Frontend URL:${NC} http://localhost:3000/"
    echo -e "${YELLOW}To start the Next.js development server:${NC}"
    echo -e "cd src/bitobytes_frontend && npm run dev"
fi