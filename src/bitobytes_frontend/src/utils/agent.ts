import { HttpAgent } from '@dfinity/agent';

// Global agent instance
let globalAgent: HttpAgent | null = null;

// Global promise to track root key fetching
let rootKeyPromise: Promise<void> | null = null;

/**
 * Creates a properly configured HttpAgent for interacting with the Internet Computer
 * @param waitForRootKey Whether to wait for the root key to be fetched before returning
 * @returns A configured HttpAgent instance
 */
export async function createAgent(waitForRootKey = true): Promise<HttpAgent> {
  // If we already have a global agent, return it
  if (globalAgent) {
    // If we need to wait for the root key and it's being fetched, wait for it
    if (waitForRootKey && rootKeyPromise) {
      try {
        await rootKeyPromise;
      } catch (err) {
        console.error('Error waiting for root key:', err);
        // If there was an error, we'll create a new agent
        globalAgent = null;
      }
    }
    
    if (globalAgent) {
      return globalAgent;
    }
  }
  
  const host = process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
  console.log('Creating agent with host:', host);
  
  const agent = new HttpAgent({
    host,
    // Disable verification for local development
    verifyQuerySignatures: false,
    // Ensure fetches complete without credentials for CORS
    fetchOptions: {
      credentials: 'omit',
    },
  });
  
  // In a local development environment, we need to fetch the root key for verification
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    if (!rootKeyPromise) {
      // Create the promise only once
      rootKeyPromise = (async () => {
        try {
          console.log('Fetching root key...');
          // Add a custom header to identify this as a root key fetch to prevent infinite recursion
          await agent.fetchRootKey();
          console.log('Root key fetched successfully');
        } catch (err) {
          console.error('Failed to fetch root key:', err);
          // Reset the promise so we can try again
          rootKeyPromise = null;
          throw err;
        }
      })();
    }
    
    if (waitForRootKey) {
      try {
        // Wait for the root key to be fetched
        await rootKeyPromise;
        // Store the agent globally only after the root key is fetched
        globalAgent = agent;
      } catch (err) {
        console.error('Error waiting for root key:', err);
        throw err;
      }
    } else {
      // Store the agent globally even if we don't wait for the root key
      globalAgent = agent;
    }
  } else {
    // For production, store the agent globally
    globalAgent = agent;
  }
  
  return agent;
}

/**
 * Gets the global agent, creating it if necessary
 * @param waitForRootKey Whether to wait for the root key to be fetched before returning
 * @returns The global HttpAgent instance
 */
export async function getAgent(waitForRootKey = true): Promise<HttpAgent> {
  if (!globalAgent) {
    return createAgent(waitForRootKey);
  }
  
  return globalAgent;
}

/**
 * Ensures the root key is fetched for local development
 * @returns A promise that resolves when the root key is fetched
 */
export async function ensureRootKey(): Promise<void> {
  const host = process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
  
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    // This will create the agent and wait for the root key
    await createAgent(true);
  }
}

/**
 * Resets the global agent, forcing a new one to be created next time
 */
export function resetAgent(): void {
  globalAgent = null;
  rootKeyPromise = null;
}
