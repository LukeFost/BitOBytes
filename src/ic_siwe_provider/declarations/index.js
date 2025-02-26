// This file contains the canister ID for the SIWE provider
// In a production environment, this would be the actual canister ID
// For local development, we'll use the environment variable set by deploy-rust-siwe.sh

// Use the environment variable if available, otherwise use a placeholder
// Note: The placeholder will not work until the canister is deployed
export const canisterId = process.env.NEXT_PUBLIC_SIWE_CANISTER_ID;

// Log the canister ID for debugging
if (!canisterId) {
  console.error("WARNING: NEXT_PUBLIC_SIWE_CANISTER_ID is not set!");
  console.error("Please run ./deploy-rust-siwe.sh to deploy the SIWE provider and set the environment variable.");
} else {
  console.log("SIWE Provider Canister ID:", canisterId);
}
