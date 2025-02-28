#!/bin/bash
# BitOBytes Management Script
# Provides utilities for maintenance, cleanup, and troubleshooting

set -e

# Color codes for formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Display help if no arguments provided
if [ $# -eq 0 ]; then
    echo -e "${BLUE}BitOBytes Management Utility${NC}"
    echo "Usage: ./manage.sh [command]"
    echo ""
    echo "Available commands:"
    echo "  clean             - Clean project files and stop local replica"
    echo "  verify            - Verify SIWE setup and project configuration"
    echo "  update-deps       - Update project dependencies"
    echo "  reset-siwe        - Reset SIWE provider configuration"
    echo "  fix-env           - Fix environment variables for canister IDs"
    echo "  test-backend      - Test backend canister methods"
    echo "  help              - Display this help message"
    exit 0
fi

# Process commands
case "$1" in
    clean)
        echo -e "${YELLOW}Cleaning up project...${NC}"
        
        # Stop dfx replica if running
        if dfx ping &> /dev/null; then
            echo "Stopping dfx replica..."
            dfx stop
        fi
        
        # Remove .dfx directory
        echo "Removing .dfx directory..."
        rm -rf .dfx
        
        # Clean frontend build artifacts
        echo "Cleaning frontend build artifacts..."
        cd src/bitobytes_frontend
        if [ -d "node_modules" ]; then
            npm run clean 2>/dev/null || echo "No clean script found, skipping..."
        fi
        cd ../..
        
        # Remove dist directory
        echo "Removing dist directory..."
        rm -rf dist
        
        echo -e "${GREEN}Project cleaned successfully.${NC}"
        ;;
        
    verify)
        echo -e "${YELLOW}Verifying project setup...${NC}"
        
        # Check dfx status
        echo "Checking dfx status..."
        if dfx ping &> /dev/null; then
            echo -e "${GREEN}Local IC replica is running.${NC}"
        else
            echo -e "${RED}Local IC replica is not running. Start it with 'dfx start --clean --background'${NC}"
            exit 1
        fi
        
        # Check SIWE canister
        echo "Checking SIWE canister..."
        SIWE_CANISTER="ic_siwe_provider"
        if dfx canister info $SIWE_CANISTER &> /dev/null; then
            CANISTER_ID=$(dfx canister id $SIWE_CANISTER)
            echo -e "${GREEN}SIWE canister ($CANISTER_ID) is installed.${NC}"
            
            # Check SIWE version
            echo "Checking SIWE version..."
            VERSION=$(dfx canister call $SIWE_CANISTER version)
            echo -e "${GREEN}SIWE provider version: ${VERSION}${NC}"
        else
            echo -e "${RED}SIWE canister is not installed.${NC}"
            echo -e "Run ${YELLOW}./setup.sh${NC} to set up the project."
            exit 1
        fi
        
        # Check frontend environment variables
        echo "Checking frontend environment variables..."
        if [ -f "src/bitobytes_frontend/.env.local" ]; then
            echo -e "${GREEN}Frontend environment file exists.${NC}"
        else
            echo -e "${RED}Frontend environment file not found.${NC}"
            echo -e "Run ${YELLOW}./setup.sh${NC} to set up the project."
            exit 1
        fi
        
        # Check frontend dependencies
        echo "Checking frontend dependencies..."
        if [ -d "src/bitobytes_frontend/node_modules" ]; then
            echo -e "${GREEN}Frontend dependencies are installed.${NC}"
        else
            echo -e "${RED}Frontend dependencies not found.${NC}"
            echo -e "Run ${YELLOW}cd src/bitobytes_frontend && npm install${NC} to install them."
            exit 1
        fi
        
        echo -e "${GREEN}Verification complete. Project setup looks good!${NC}"
        ;;
        
    update-deps)
        echo -e "${YELLOW}Updating dependencies...${NC}"
        
        # Update frontend dependencies
        echo "Updating frontend dependencies..."
        cd src/bitobytes_frontend
        
        # Specifically update SIWE-related packages
        echo "Updating ic-siwe-js and related packages..."
        npm update @dfinity/agent @dfinity/auth-client @dfinity/candid @dfinity/principal ic-siwe-js
        
        # Clean npm cache
        echo "Cleaning npm cache..."
        npm cache clean --force
        
        # Reinstall dependencies
        echo "Reinstalling all dependencies..."
        rm -rf node_modules
        npm install
        
        cd ../..
        echo -e "${GREEN}Dependencies updated successfully.${NC}"
        ;;
        
    reset-siwe)
        echo -e "${YELLOW}Resetting SIWE configuration...${NC}"
        
        # Stop dfx if running
        if dfx ping &> /dev/null; then
            echo "Stopping dfx replica..."
            dfx stop
        fi
        
        echo "Starting clean replica..."
        dfx start --clean --background
        
        # Clear SIWE provider data
        echo "Clearing SIWE provider data..."
        SIWE_CANISTER="ic_siwe_provider"
        
        # Create and deploy SIWE provider
        echo "Re-deploying SIWE provider..."
        dfx canister create $SIWE_CANISTER
        
        # Get the canister ID
        CANISTER_ID=$(dfx canister id $SIWE_CANISTER)
        echo -e "${GREEN}SIWE provider canister ID: ${CANISTER_ID}${NC}"
        
        # Deploy the SIWE provider canister
        echo "Deploying SIWE provider canister..."
        dfx deploy $SIWE_CANISTER --argument="(record { 
            domain = \"localhost:3000\"; 
            uri = \"http://localhost:3000\";
            statement = \"Sign in with Ethereum to BitOBytes\";
            chain_id = 1;
            session_expiration_time = 604800;
            signature_expiration_time = 300;
            version = \"1\";
            nonce_cache_slots = 8;
            nonce_expiration_time = 600;
        })"
        
        # Update environment variables
        echo "Updating environment variables..."
        cd src/bitobytes_frontend
        echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID" > .env.local
        echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> .env.local
        cd ../..
        
        echo -e "${GREEN}SIWE provider reset complete.${NC}"
        echo -e "${YELLOW}IMPORTANT: Remember to clear your browser storage/cache before testing.${NC}"
        ;;

    fix-env)
        echo -e "${YELLOW}Fixing environment variables...${NC}"
        
        # Get canister IDs
        BACKEND_ID=$(dfx canister id bitobytes_backend 2>/dev/null || echo "")
        SIWE_ID=$(dfx canister id ic_siwe_provider 2>/dev/null || echo "")
        
        if [ -z "$BACKEND_ID" ] || [ -z "$SIWE_ID" ]; then
            echo -e "${RED}Cannot fix environment variables - one or more canisters are not deployed.${NC}"
            echo -e "${RED}Run 'dfx deploy' to deploy all canisters first.${NC}"
            exit 1
        fi
        
        # Create or update .env.local
        echo -e "${BLUE}Creating/updating .env.local file...${NC}"
        echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$SIWE_ID" > src/bitobytes_frontend/.env.local
        echo "NEXT_PUBLIC_BACKEND_CANISTER_ID=$BACKEND_ID" >> src/bitobytes_frontend/.env.local
        echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> src/bitobytes_frontend/.env.local
        
        echo -e "${GREEN}Environment variables fixed:${NC}"
        echo -e "  NEXT_PUBLIC_SIWE_CANISTER_ID=$SIWE_ID"
        echo -e "  NEXT_PUBLIC_BACKEND_CANISTER_ID=$BACKEND_ID"
        echo -e "  NEXT_PUBLIC_IC_HOST=http://localhost:4943"
        ;;
    
    test-backend)
        echo -e "${YELLOW}Testing backend canister...${NC}"
        
        # Get backend canister ID
        BACKEND_ID=$(dfx canister id bitobytes_backend 2>/dev/null || echo "Not deployed")
        if [ "$BACKEND_ID" == "Not deployed" ]; then
            echo -e "${RED}Backend canister is not deployed. Run 'dfx deploy bitobytes_backend'${NC}"
            exit 1
        fi
        
        # Test getVideos method
        echo -e "${BLUE}Testing getVideos method...${NC}"
        dfx canister call bitobytes_backend getVideos
        
        # Test getRecommendedFeed method
        echo -e "\n${BLUE}Testing getRecommendedFeed method...${NC}"
        dfx canister call bitobytes_backend getRecommendedFeed "(null, 5)"
        ;;
        
    help)
        echo -e "${BLUE}BitOBytes Management Utility${NC}"
        echo "Usage: ./manage.sh [command]"
        echo ""
        echo "Available commands:"
        echo "  clean             - Clean project files and stop local replica"
        echo "  verify            - Verify SIWE setup and project configuration"
        echo "  update-deps       - Update project dependencies"
        echo "  reset-siwe        - Reset SIWE provider configuration"
        echo "  fix-env           - Fix environment variables for canister IDs"
        echo "  test-backend      - Test backend canister methods"
        echo "  help              - Display this help message"
        ;;
        
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Run './manage.sh help' for a list of available commands."
        exit 1
        ;;
esac