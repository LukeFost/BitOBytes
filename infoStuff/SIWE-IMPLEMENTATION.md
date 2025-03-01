# Sign In With Ethereum (SIWE) Implementation Guide

This document provides instructions on how to use the SIWE authentication in the BitOBytes project.

## Overview

The BitOBytes project uses the Sign In With Ethereum (SIWE) standard to authenticate users. This implementation allows users to connect their Ethereum wallet and sign a message to authenticate with the Internet Computer.

## Local Development

### Setup

1. Make sure you have the Internet Computer SDK (dfx) installed:
   ```bash
   sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
   ```

2. Start the local Internet Computer replica:
   ```bash
   dfx start --clean --background
   ```

3. Deploy the SIWE provider for local development:
   ```bash
   ./deploy-siwe.sh
   ```

4. Deploy the backend canister:
   ```bash
   dfx deploy bitobytes_backend
   ```

5. Start the Next.js development server:
   ```bash
   cd src/bitobytes_frontend
   npm run dev
   ```

6. Open your browser and navigate to http://localhost:3000

### Authentication Flow

1. Click the "Connect" button to connect your Ethereum wallet
2. Once connected, click the "Sign Wallet" button to sign the SIWE message
3. After signing, you'll be authenticated and can access protected resources

## Production Deployment

### Setup

1. Update the production domain in the `deploy-siwe.sh` script:
   ```bash
   DOMAIN="your-production-domain.icp0.io"
   URI="https://your-production-domain.icp0.io"
   ```

2. Deploy the SIWE provider for production:
   ```bash
   ./deploy-siwe.sh production
   ```

3. Deploy the backend canister:
   ```bash
   dfx deploy --network ic bitobytes_backend
   ```

4. Build and deploy the frontend:
   ```bash
   cd src/bitobytes_frontend
   npm run build
   dfx deploy --network ic bitobytes_frontend
   ```

## Environment Variables

The following environment variables are used for the SIWE implementation:

- `NEXT_PUBLIC_SIWE_CANISTER_ID`: The canister ID of the SIWE provider
- `NEXT_PUBLIC_IC_HOST`: The host of the Internet Computer replica (http://localhost:4943 for local development, https://ic0.app for production)

These variables are automatically set by the `deploy-siwe.sh` script.

## Troubleshooting

### Common Issues

1. **"BLS DER-encoded public key must be 133 bytes long" error**:
   - This error occurs when the root key is not properly fetched or when the SIWE provider is not properly configured.
   - Make sure you're running the latest version of dfx.
   - Try restarting the local replica with `dfx start --clean --background`.
   - Redeploy the SIWE provider with `./deploy-siwe.sh`.

2. **"Failed to fetch root key" error**:
   - This error occurs when the API routes can't connect to the Internet Computer replica.
   - Make sure the replica is running with `dfx ping`.
   - Check that the `NEXT_PUBLIC_IC_HOST` environment variable is correctly set.

3. **Authentication fails after signing the message**:
   - Check the browser console for errors.
   - Make sure the SIWE provider is correctly configured with the right domain and URI.
   - Verify that the management canister redirection is working correctly in the API routes.

## References

- [SIWE Specification (EIP-4361)](https://eips.ethereum.org/EIPS/eip-4361)
- [ic-siwe-js Documentation](https://github.com/kristoferlund/ic-siwe/tree/main/packages/ic-siwe-js)
- [Internet Computer Documentation](https://internetcomputer.org/docs/current/developer-docs/)
