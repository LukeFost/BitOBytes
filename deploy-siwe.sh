#!/bin/bash

# Script to deploy the SIWE provider with environment-specific configuration

# Determine the environment
if [ "$1" == "production" ]; then
  echo "Deploying SIWE provider for production environment"
  DOMAIN="your-production-domain.icp0.io"  # Replace with your actual production domain
  URI="https://your-production-domain.icp0.io"  # Replace with your actual production URI
  SCHEME="https"
else
  echo "Deploying SIWE provider for local development environment"
  DOMAIN="127.0.0.1"
  URI="http://localhost:3000"  # Using Next.js default port
  SCHEME="http"
fi

# Deploy the SIWE provider
dfx deploy ic_siwe_provider --argument "( \
    record { \
        domain = \"$DOMAIN\"; \
        uri = \"$URI\"; \
        salt = \"salt\"; \
        chain_id = opt 1; \
        scheme = opt \"$SCHEME\"; \
        statement = opt \"Login to the BitOBytes app\"; \
        sign_in_expires_in = opt 300000000000; /* 5 minutes */ \
        session_expires_in = opt 604800000000000; /* 1 week */ \
        targets = opt vec { \
            \"$(dfx canister id ic_siwe_provider)\"; \
            \"$(dfx canister id bitobytes_backend)\"; \
        }; \
    } \
)"

# Generate the declarations
dfx generate ic_siwe_provider

# Update the .env.local file with the canister ID
SIWE_CANISTER_ID=$(dfx canister id ic_siwe_provider)
echo "SIWE provider canister ID: $SIWE_CANISTER_ID"

# Check if .env.local exists
if [ -f "src/bitobytes_frontend/.env.local" ]; then
  # Update the existing file
  sed -i '' "s/NEXT_PUBLIC_SIWE_CANISTER_ID=.*/NEXT_PUBLIC_SIWE_CANISTER_ID=$SIWE_CANISTER_ID/" src/bitobytes_frontend/.env.local
else
  # Create a new file
  echo "NEXT_PUBLIC_SIWE_CANISTER_ID=$SIWE_CANISTER_ID" > src/bitobytes_frontend/.env.local
  
  # Add the IC host based on environment
  if [ "$1" == "production" ]; then
    echo "NEXT_PUBLIC_IC_HOST=https://ic0.app" >> src/bitobytes_frontend/.env.local
  else
    echo "NEXT_PUBLIC_IC_HOST=http://localhost:4943" >> src/bitobytes_frontend/.env.local
  fi
fi

echo "SIWE provider deployed successfully!"
