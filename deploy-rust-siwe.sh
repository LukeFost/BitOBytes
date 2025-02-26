#!/bin/bash

# This script deploys the Rust-based SIWE provider canister

# Exit on error
set -e

echo "Deploying Rust-based SIWE provider canister..."

# Check if dfx is installed
if ! command -v dfx &> /dev/null; then
    echo "Error: dfx is not installed. Please install the Internet Computer SDK."
    exit 1
fi

# Check if dfx is running
if ! dfx ping &> /dev/null; then
    echo "Starting local dfx replica..."
    dfx start --background
fi

# Deploy the SIWE provider canister
echo "Creating SIWE provider canister..."
dfx canister create ic_siwe_provider

# Get the canister ID
CANISTER_ID=$(dfx canister id ic_siwe_provider)
echo "SIWE provider canister ID: $CANISTER_ID"

# Update the environment variables
echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID" > src/bitobytes_frontend/.env.local
echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$CANISTER_ID" > src/bitobytes_frontend/.env
echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> src/bitobytes_frontend/.env

echo "Deploying Rust-based SIWE provider canister..."
dfx deploy ic_siwe_provider --argument '(
    record {
        domain = "bitobytes.icp";
        uri = "https://bitobytes.icp";
        salt = "bitobytes-salt-123";
        chain_id = opt 1;
        scheme = opt "https";
        statement = opt "Sign in with Ethereum to BitOBytes on the Internet Computer";
        sign_in_expires_in = opt 3_600_000_000_000;
        session_expires_in = opt 86_400_000_000_000;
        targets = opt vec {
            "'$CANISTER_ID'";
        };
    }
)'

echo "Rust-based SIWE provider canister deployed successfully!"
echo "Canister ID: $CANISTER_ID"
echo "Environment variable set in src/bitobytes_frontend/.env.local"
