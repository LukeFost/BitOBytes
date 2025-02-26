#!/bin/bash

# Get the canister ID from environment variables or from the .env file
CANISTER_ID=$(grep NEXT_PUBLIC_SIWE_CANISTER_ID src/bitobytes_frontend/.env | cut -d '=' -f2)

echo "Testing SIWE canister with ID: $CANISTER_ID"

# Try to call a simple method on the canister
echo "Checking canister status..."
dfx canister status $CANISTER_ID

echo "Trying to call version method..."
dfx canister call $CANISTER_ID version

echo "Testing completed. If you see a version number above, the canister is accessible."
