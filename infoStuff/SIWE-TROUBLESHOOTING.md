# SIWE Troubleshooting Guide

This document provides solutions for common issues when implementing Sign-In With Ethereum (SIWE) in your Internet Computer application.

## Common Errors

### "BLS DER-encoded public key must be 133 bytes long"

This error occurs due to incompatibility between the Internet Computer identity libraries and the BLS keys used for delegation. 

**Solution:**

1. Update to the latest `ic-siwe-js` library version:
   ```bash
   npm install ic-siwe-js@latest @dfinity/agent@latest @dfinity/identity@latest
   ```

2. Clear browser storage:
   - Chrome/Edge: DevTools > Application > Storage > Clear site data
   - Firefox: DevTools > Storage > Local Storage > Right click > Delete All

3. Redeployment steps:
   ```bash
   # Stop any running dfx instances
   dfx stop
   
   # Start with a clean state
   dfx start --clean
   
   # Re-deploy the SIWE provider canister
   ./deploy-rust-siwe.sh
   ```

### API Request Errors (400 Bad Request)

If you see errors like `POST http://localhost:3000/api/v2/canister/...` or `/api/v3/canister/...` with 400 Bad Request responses:

**Solution:**

1. Ensure your Next.js rewrites are correctly configured in `next.config.js`
2. Add explicit proxy routes for the specific API endpoints
3. Check that the environment variables are correctly set
4. Verify that the IC replica is running (`dfx ping` should succeed)

### Connection Issues with IC Replica

**Solution:**

1. Ensure the IC replica is running: `dfx ping`
2. Check that `NEXT_PUBLIC_IC_HOST` is set to `http://localhost:4943`
3. Verify the agent is configured with `verifyQuerySignatures: false` for local development

## General Troubleshooting Steps

1. **Reset Environment**:
   ```bash
   ./reset-siwe.sh
   ```

2. **Check Canister Status**:
   ```bash
   dfx canister status ic_siwe_provider
   ```

3. **Test Direct Canister Call**:
   ```bash
   dfx canister call ic_siwe_provider version
   ```

4. **Debug Mode**:
   Enable more verbose logging by setting localStorage:
   ```javascript
   localStorage.setItem('debug', 'ic-siwe-js:*');
   ```

5. **Version Compatibility**:
   Ensure that the versions of `ic-siwe-js` npm package and the `ic_siwe_provider` canister WASM module are compatible.

## Advanced Configuration

For advanced users, you can configure the SIWE provider with custom parameters:

```bash
dfx deploy ic_siwe_provider --argument '(
    record {
        domain = "your-domain.icp";
        uri = "https://your-domain.icp";
        salt = "unique-salt-value";
        chain_id = opt 1;
        scheme = opt "https";
        statement = opt "Custom sign-in message";
        sign_in_expires_in = opt 3_600_000_000_000;
        session_expires_in = opt 86_400_000_000_000;
    }
)'
```

## Still Having Issues?

If you continue to experience problems after trying these solutions:

1. Check the [ic-siwe GitHub repository](https://github.com/kristoferlund/ic-siwe) for recent issues
2. Verify your Ethereum wallet is properly connected and on a supported network
3. Try with a different browser or wallet to isolate the issue
