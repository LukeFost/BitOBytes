import { HttpAgent } from '@dfinity/agent';

// Store the original fetch function
let originalFetch: typeof fetch | null = null;

// Flag to track if the root key has been fetched
let rootKeyFetched = false;

// Promise to track the root key fetching process
let rootKeyPromise: Promise<void> | null = null;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Initialize originalFetch in browser environment
if (isBrowser) {
  originalFetch = window.fetch;
}

/**
 * Ensures the root key is fetched for local development
 * @returns A promise that resolves when the root key is fetched
 */
export async function ensureRootKey(): Promise<void> {
  const host = process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
  
  // Only fetch the root key for local development
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    return;
  }
  
  // If the root key has already been fetched, return immediately
  if (rootKeyFetched) {
    return;
  }
  
  // If there's an existing promise, wait for it
  if (rootKeyPromise) {
    await rootKeyPromise;
    return;
  }
  
  // Create a new promise to fetch the root key
  rootKeyPromise = (async () => {
    try {
      console.log('Fetching root key for local development...');
      const agent = new HttpAgent({
        host,
        fetchOptions: { credentials: 'omit' }
      });
      await agent.fetchRootKey();
      console.log('Root key fetched successfully');
      rootKeyFetched = true;
    } catch (error) {
      console.error('Failed to fetch root key:', error);
      // Reset the promise so we can try again
      rootKeyPromise = null;
      throw error;
    }
  })();
  
  await rootKeyPromise;
}

// Flag to track if we're currently inside a fetch for the root key
let fetchingRootKey = false;

/**
 * Patches the global fetch function to ensure the root key is fetched before
 * making requests to the Internet Computer
 */
export function patchFetch(): void {
  // Only patch in the browser environment
  if (typeof window === 'undefined') {
    return;
  }
  
  // Only patch once
  if (window.fetch !== originalFetch) {
    return;
  }
  
  // Replace the global fetch function with our patched version
  window.fetch = async function patchedFetch(input, init) {
    // Check if this is a request to the Internet Computer
    const url = input instanceof Request ? input.url : String(input);
    const host = process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
    
    // If this is a request to the local Internet Computer and we're not already fetching the root key,
    // ensure the root key is fetched
    if (!fetchingRootKey && 
        (url.includes(host) || url.includes('/api/v2/') || url.includes('/api/v3/')) && 
        (host.includes('localhost') || host.includes('127.0.0.1'))) {
      
      // If the URL contains "fetch_root_key", we're fetching the root key
      if (url.includes('fetch_root_key')) {
        fetchingRootKey = true;
      } else {
        try {
          // Only try to ensure root key if we're not already fetching it
          if (rootKeyFetched === false && rootKeyPromise === null) {
            await ensureRootKey();
          } else if (rootKeyPromise) {
            await rootKeyPromise;
          }
        } catch (error) {
          console.error('Failed to fetch root key before request:', error);
          // Continue with the request even if root key fetching fails
        }
      }
    }
    
    // Call the original fetch function
    if (!originalFetch) {
      console.error('Original fetch function is not available');
      return window.fetch(input, init);
    }
    
    try {
      return await originalFetch.call(window, input, init);
    } finally {
      // Reset the flag after the fetch is complete
      if (fetchingRootKey && url.includes('fetch_root_key')) {
        fetchingRootKey = false;
      }
    }
  };
  
  console.log('Patched fetch function to ensure root key is fetched');
}

/**
 * Restores the original fetch function
 */
export function restoreFetch(): void {
  if (typeof window !== 'undefined' && window.fetch !== originalFetch && originalFetch !== null) {
    window.fetch = originalFetch;
    console.log('Restored original fetch function');
  }
}
