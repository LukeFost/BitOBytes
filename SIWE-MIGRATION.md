# SIWE Migration: Motoko to Rust Implementation

This document explains the migration from the custom Motoko-based SIWE provider to the official Rust-based implementation.

## Changes Made

1. **Updated dfx.json**
   - Replaced the Motoko-based `ic_siwe_provider` with the pre-built Rust canister
   - The canister now uses the official WASM module and candid interface

2. **Created New Deployment Script**
   - Added `deploy-rust-siwe.sh` for deploying the Rust-based SIWE provider
   - Configured with appropriate settings for BitOBytes

3. **Updated Documentation**
   - Updated README-SIWE.md to reflect the new implementation
   - Added information about the security benefits

## Benefits of the Rust Implementation

### 1. Security Improvements

- **Proper Cryptographic Verification**: Unlike the Motoko placeholder that accepted any signature, the Rust implementation properly verifies Ethereum signatures.
- **Nonce-based Security**: Prevents replay attacks with proper nonce handling.
- **Timebound Sessions**: Configurable expiration for both sign-in messages and sessions.
- **Delegation Targets**: Restricts which canisters can use the delegated identity.

### 2. Compatibility

- **Standard Compliance**: Follows the EIP-4361 (SIWE) standard for secure authentication.
- **Frontend Compatibility**: Works seamlessly with the existing `ic-siwe-js` library.
- **No Frontend Changes Required**: Your existing React components should work without modification.

### 3. Maintainability

- **Production-Ready**: The Rust implementation is production-ready with comprehensive error handling.
- **Well-Documented**: Extensive documentation and examples available.
- **Actively Maintained**: Regular updates and security patches.

## How It Works

The Rust-based SIWE provider follows this authentication flow:

1. **Prepare Login**: Generates a SIWE message with a nonce for the user to sign.
2. **Login**: Verifies the signature and creates a delegation for the session.
3. **Get Delegation**: Provides a signed delegation that can be used for authentication.

## Configuration Options

The Rust-based SIWE provider is configured with these parameters:

- `domain`: The domain from where the frontend is served
- `uri`: The full URI of the frontend
- `salt`: Used for generating unique user principals
- `chain_id`: Ethereum chain ID (default: 1 for mainnet)
- `scheme`: Protocol scheme (http/https)
- `statement`: Message shown to users when signing
- `sign_in_expires_in`: TTL for sign-in messages (nanoseconds)
- `session_expires_in`: TTL for sessions (nanoseconds)
- `targets`: List of canisters allowed for delegation

## Testing the Migration

To test the migration:

1. Deploy the Rust-based SIWE provider:
   ```bash
   ./deploy-rust-siwe.sh
   ```

2. Start the development server:
   ```bash
   dfx start --background
   dfx deploy
   cd src/bitobytes_frontend
   npm run dev
   ```

3. Test the authentication flow by signing in with an Ethereum wallet.

## Troubleshooting

### Canister ID Not Found Error

If you encounter a "canister_id_not_found" error, follow these steps:

1. Make sure you've deployed the Rust-based SIWE provider:
   ```bash
   ./deploy-rust-siwe.sh
   ```

2. Verify that the environment variables are set correctly:
   - Check that `src/bitobytes_frontend/.env` contains the correct canister ID
   - The canister ID should match the output from `dfx canister id ic_siwe_provider`

3. Restart your Next.js development server:
   ```bash
   cd src/bitobytes_frontend
   npm run dev
   ```

4. If the issue persists, try clearing your browser cache or using an incognito window.

### Other Common Issues

- If you encounter issues with the deployment, check the dfx.json configuration.
- If authentication fails after successful deployment, check the browser console for specific error messages.
- For wallet connection issues, make sure your wallet is unlocked and connected to a supported network.
