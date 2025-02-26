# Step-by-Step Guide to Fix SIWE Integration

This guide provides detailed steps to fix the "BLS DER-encoded public key must be 133 bytes long" error in your SIWE (Sign-In With Ethereum) implementation.

## Prerequisites

- Ensure `dfx` CLI is installed and updated to the latest version
- Make sure you have Node.js and npm installed
- Clear browser storage for your local development site

## Step 1: Make Scripts Executable

```bash
# Make all scripts executable
chmod +x make-scripts-executable.sh
./make-scripts-executable.sh
```

## Step 2: Reset the SIWE Environment

```bash
# This stops dfx, clears existing canister data, and redeploys the SIWE provider
./reset-siwe.sh
```

## Step 3: Verify the SIWE Canister is Accessible

```bash
# Test if the SIWE canister is accessible and responding
./test-siwe-canister.sh
```

If this step fails, you might need to manually deploy the SIWE provider:

```bash
dfx deploy ic_siwe_provider
```

## Step 4: Update Frontend Dependencies

```bash
# Navigate to the frontend directory
cd src/bitobytes_frontend

# Update dependencies (optional if reset-siwe.sh already did this)
npm install
```

## Step 5: Start the Development Server

```bash
# In the frontend directory
npm run dev
```

## Step 6: Test Authentication in Browser

1. Open http://localhost:3000 in your browser
2. Open browser DevTools (F12) to monitor for errors
3. Connect your Ethereum wallet
4. Click on "Sign Wallet"
5. Check the console for detailed error messages

## Troubleshooting

If you're still encountering issues:

### Check Environment Variables

Ensure these values are correctly set in `.env` and `.env.local`:

```
NEXT_PUBLIC_SIWE_CANISTER_ID=<your-canister-id>
NEXT_PUBLIC_IC_HOST=http://localhost:4943
```

### Verify API Routing

If API requests are failing, try adding these lines to your browser console:

```javascript
// Enable debug logging
localStorage.setItem('debug', 'ic-siwe-js:*');
```

### Test Direct SIWE Provider Interactions

Try calling the SIWE provider directly from the terminal:

```bash
dfx canister call ic_siwe_provider version
```

### Try with Different Browser/Wallet

Sometimes issues can be browser or wallet-specific. Try using a different browser or wallet to isolate the issue.

## If All Else Fails

As a last resort, you can try a complete reset:

```bash
# Stop dfx
dfx stop

# Remove all .dfx data
rm -rf .dfx

# Remove node_modules
rm -rf src/bitobytes_frontend/node_modules

# Install fresh dependencies
cd src/bitobytes_frontend
npm install

# Start fresh dfx instance
dfx start --clean --background

# Deploy everything
dfx deploy
```
