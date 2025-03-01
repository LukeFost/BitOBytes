./# SIWE BLS Error Fix Guide

This document explains the changes made to fix the "BLS DER-encoded public key must be 133 bytes long" error in the BitOBytes project.

## Changes Made

1. **Fixed Server-Side Rendering Issues**
   - Modified `rootKeyFetch.ts` to safely handle server-side rendering
   - Updated `_app.tsx` to conditionally apply the fetch patch only in browser environments
   - Added proper checks for browser-specific objects like `window`

2. **Applied Fetch Patch in _app.tsx**
   - Added `patchFetch()` call to ensure the root key is fetched before any requests to the Internet Computer
   - Enabled debug logging for ic-siwe-js to provide more detailed error information
   - Added fallback for canisterId to ensure it's always a string

3. **Updated Canister ID Handling in declarations/index.js**
   - Removed the hardcoded fallback canister ID to prevent mismatches
   - Added error logging when the canister ID is not set

4. **Enhanced Root Key Fetching in AuthProvider.tsx**
   - Added retry mechanism for root key fetching failures
   - Improved error handling and logging

5. **Improved API Routes**
   - Enhanced error handling for management canister redirects
   - Added better logging for debugging
   - Improved error messages for missing canister IDs

6. **Created Verification Script**
   - Added `verify-siwe-setup.sh` to check and fix common issues with the SIWE setup

## How to Fix the BLS Error

If you're still experiencing the "BLS DER-encoded public key must be 133 bytes long" error, follow these steps:

### Step 1: Run the Verification Script

```bash
./verify-siwe-setup.sh
```

This script will:
- Check if dfx is running
- Verify the SIWE canister exists and is accessible
- Ensure environment variables are correctly set
- Check frontend dependencies

### Step 2: Clear Browser Storage

Clear your browser's local storage to remove any cached SIWE data:
- Chrome/Edge: DevTools > Application > Storage > Clear site data
- Firefox: DevTools > Storage > Local Storage > Right click > Delete All

### Step 3: Restart the Development Server

```bash
cd src/bitobytes_frontend
npm run dev
```

### Step 4: If the Error Persists

If the error still persists, try a complete reset:

```bash
./reset-siwe.sh
```

This will:
- Stop any running dfx instances
- Clear the .dfx directory for the SIWE provider
- Start dfx with a clean state
- Deploy the SIWE provider with proper arguments

## Understanding the BLS Error

The "BLS DER-encoded public key must be 133 bytes long" error occurs when:

1. The root key is not properly fetched for local development
2. There's a mismatch between the canister ID used in the code and the actual canister ID
3. The management canister redirect is not working correctly
4. There are cached delegations in the browser that are no longer valid

The changes made address all these potential causes by:
- Ensuring the root key is fetched before any requests
- Verifying the canister ID is consistent across all files
- Improving the management canister redirect logic
- Providing clear instructions for clearing browser storage

## Debugging Tips

1. Check the browser console for errors
2. Look for "Root key fetched successfully" messages
3. Verify the canister ID being used matches the actual canister ID
4. Check the API route logs for any errors in the management canister redirect

## References

- [SIWE Specification (EIP-4361)](https://eips.ethereum.org/EIPS/eip-4361)
- [ic-siwe-js Documentation](https://github.com/kristoferlund/ic-siwe/tree/main/packages/ic-siwe-js)
- [Internet Computer Documentation](https://internetcomputer.org/docs/current/developer-docs/)
