# Sign in with Ethereum (SIWE) for BitOBytes

This document provides instructions on how to use the Sign in with Ethereum (SIWE) functionality in the BitOBytes application.

## Overview

BitOBytes now supports authentication using Ethereum wallets through the Sign in with Ethereum (SIWE) protocol. This allows users to sign in using their Ethereum wallet (like MetaMask) instead of traditional username/password authentication.

## Prerequisites

- An Ethereum wallet (MetaMask, WalletConnect, etc.)
- Internet Computer SDK (dfx) installed

## Setup

1. Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/yourusername/BitOBytes.git
cd BitOBytes
```

2. Install dependencies:

```bash
cd src/bitobytes_frontend
npm install
```

3. Deploy the Rust-based SIWE provider canister:

```bash
chmod +x deploy-rust-siwe.sh
./deploy-rust-siwe.sh
```
   This script will:
   - Create the SIWE provider canister
   - Set the necessary environment variables
   - Deploy the canister with the appropriate configuration

4. Start the development server:

```bash
# If dfx is not already running
dfx start --background

# Deploy all canisters
dfx deploy

# Start the Next.js development server
cd src/bitobytes_frontend
npm run dev
```

5. Verify the deployment:
   - Check that the canister ID is correctly set in the environment variables
   - The canister ID should match the output from `dfx canister id ic_siwe_provider`

## Usage

1. Navigate to the application in your browser (usually at http://localhost:3000).
2. Click on "Sign In" in the navigation bar.
3. On the sign-in page, follow these steps:
   - Step 1: Connect your Ethereum wallet by clicking the "Connect Wallet" button.
   - Step 2: Sign in with Ethereum by clicking the "Sign In with Ethereum" button.
   - Your wallet will prompt you to sign a message. This signature is used to authenticate you with the Internet Computer.
4. Once signed in, you can access protected routes like the Profile page.

## Test Signing

The sign-in page also includes a "Test Sign" button that allows you to test your wallet's signing capability without going through the full authentication flow. This is useful for debugging or verifying that your wallet is working correctly.

## Implementation Details

The SIWE functionality is implemented using the following components:

- `ic-siwe-js`: A JavaScript library for integrating SIWE with Internet Computer applications.
- `wagmi`: A React hooks library for Ethereum.
- `viem`: A TypeScript interface for Ethereum.
- `ic_siwe_provider`: A Rust-based canister that handles the SIWE authentication on the Internet Computer.

## Troubleshooting

- If you encounter issues with wallet connection, make sure your wallet is unlocked and connected to the correct network (Ethereum Mainnet or Sepolia Testnet).
- If you see errors related to the SIWE provider canister, make sure it's deployed correctly by running `./deploy-rust-siwe.sh`.
- For other issues, check the browser console for error messages.

## Security Considerations

- The SIWE implementation uses delegated identity, which means your Ethereum private key is never exposed to the application.
- The signed message includes a nonce and expiration time to prevent replay attacks.
- The delegation has a limited lifetime (24 hours by default) after which you'll need to sign in again.
- The Rust-based implementation provides proper cryptographic verification of Ethereum signatures.
- The implementation follows the EIP-4361 (SIWE) standard for secure authentication.
