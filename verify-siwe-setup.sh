#!/bin/bash

# Exit on error
set -e

echo "===== SIWE Setup Verification Tool ====="
echo "This script will check your SIWE setup and help fix common issues."
echo

# Check if dfx is installed
if ! command -v dfx &> /dev/null; then
    echo "❌ dfx is not installed. Please install the Internet Computer SDK."
    exit 1
fi

# Check if dfx is running
if ! dfx ping &> /dev/null; then
    echo "❌ dfx is not running. Starting local replica..."
    dfx start --background
    sleep 5
else
    echo "✅ dfx is running"
fi

# Check if the SIWE canister exists
if ! dfx canister id ic_siwe_provider &> /dev/null; then
    echo "❌ SIWE provider canister does not exist. Deploying..."
    ./deploy-rust-siwe.sh
else
    echo "✅ SIWE provider canister exists"
    CANISTER_ID=$(dfx canister id ic_siwe_provider)
    echo "   Canister ID: $CANISTER_ID"
fi

# Check if the SIWE canister is accessible
echo "Testing SIWE canister..."
if ! dfx canister call ic_siwe_provider version &> /dev/null; then
    echo "❌ SIWE provider canister is not accessible. Redeploying..."
    ./deploy-rust-siwe.sh
else
    echo "✅ SIWE provider canister is accessible"
    VERSION=$(dfx canister call ic_siwe_provider version)
    echo "   Version: $VERSION"
fi

# Check environment variables
echo "Checking environment variables..."
CANISTER_ID=$(dfx canister id ic_siwe_provider)

# Check .env.local
if [ -f "src/bitobytes_frontend/.env.local" ]; then
    ENV_CANISTER_ID=$(grep NEXT_PUBLIC_SIWE_CANISTER_ID src/bitobytes_frontend/.env.local | cut -d '=' -f2)
    if [ "$ENV_CANISTER_ID" != "$CANISTER_ID" ]; then
        echo "❌ NEXT_PUBLIC_SIWE_CANISTER_ID in .env.local does not match the actual canister ID"
        echo "   Updating .env.local..."
        sed -i '' "s/NEXT_PUBLIC_SIWE_CANISTER_ID=.*/NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID/" src/bitobytes_frontend/.env.local
    else
        echo "✅ NEXT_PUBLIC_SIWE_CANISTER_ID in .env.local is correct"
    fi
    
    if ! grep -q "NEXT_PUBLIC_IC_HOST" src/bitobytes_frontend/.env.local; then
        echo "❌ NEXT_PUBLIC_IC_HOST is not set in .env.local"
        echo "   Adding NEXT_PUBLIC_IC_HOST to .env.local..."
        echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> src/bitobytes_frontend/.env.local
    else
        echo "✅ NEXT_PUBLIC_IC_HOST is set in .env.local"
    fi
else
    echo "❌ .env.local does not exist. Creating..."
    echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID" > src/bitobytes_frontend/.env.local
    echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> src/bitobytes_frontend/.env.local
fi

# Check .env
if [ -f "src/bitobytes_frontend/.env" ]; then
    ENV_CANISTER_ID=$(grep NEXT_PUBLIC_SIWE_CANISTER_ID src/bitobytes_frontend/.env | cut -d '=' -f2)
    if [ "$ENV_CANISTER_ID" != "$CANISTER_ID" ]; then
        echo "❌ NEXT_PUBLIC_SIWE_CANISTER_ID in .env does not match the actual canister ID"
        echo "   Updating .env..."
        sed -i '' "s/NEXT_PUBLIC_SIWE_CANISTER_ID=.*/NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID/" src/bitobytes_frontend/.env
    else
        echo "✅ NEXT_PUBLIC_SIWE_CANISTER_ID in .env is correct"
    fi
    
    if ! grep -q "NEXT_PUBLIC_IC_HOST" src/bitobytes_frontend/.env; then
        echo "❌ NEXT_PUBLIC_IC_HOST is not set in .env"
        echo "   Adding NEXT_PUBLIC_IC_HOST to .env..."
        echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> src/bitobytes_frontend/.env
    else
        echo "✅ NEXT_PUBLIC_IC_HOST is set in .env"
    fi
else
    echo "❌ .env does not exist. Creating..."
    echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID" > src/bitobytes_frontend/.env
    echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> src/bitobytes_frontend/.env
fi

# Check if the frontend dependencies are installed
echo "Checking frontend dependencies..."
if [ ! -d "src/bitobytes_frontend/node_modules" ]; then
    echo "❌ Frontend dependencies are not installed. Installing..."
    cd src/bitobytes_frontend
    npm install --legacy-peer-deps
    cd ../..
else
    echo "✅ Frontend dependencies are installed"
fi

# Check for server-side rendering issues
echo "Checking for server-side rendering issues..."
if grep -q "window is not defined" src/bitobytes_frontend/dist/server/pages/_app.js 2>/dev/null; then
    echo "❌ Server-side rendering issue detected: 'window is not defined'"
    echo "   This is likely caused by accessing browser-specific objects in a server context."
    echo "   Please ensure all browser-specific code is wrapped in 'if (typeof window !== 'undefined')' checks."
else
    echo "✅ No obvious server-side rendering issues detected"
fi

echo
echo "===== Verification Complete ====="
echo
echo "If you're still experiencing the 'BLS DER-encoded public key must be 133 bytes long' error:"
echo "1. Clear your browser's local storage:"
echo "   - Chrome/Edge: DevTools > Application > Storage > Clear site data"
echo "   - Firefox: DevTools > Storage > Local Storage > Right click > Delete All"
echo "2. Restart the development server:"
echo "   cd src/bitobytes_frontend && npm run dev"
echo "3. Try logging in again"
echo
echo "If you see 'window is not defined' errors:"
echo "1. Make sure all browser-specific code is wrapped in checks:"
echo "   if (typeof window !== 'undefined') { /* browser-only code */ }"
echo "2. Ensure fetch patching happens only in the browser context"
echo
echo "If the error persists, try a complete reset:"
echo "./reset-siwe.sh"
echo
