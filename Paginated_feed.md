Below is the complete project code as currently shown, plus an example of how to implement a per-user video queue and a paginated “feed” API in your Motoko canister, along with the frontend usage (React Query infinite scroll).

All existing files are shown first exactly as they stand, and afterwards you’ll find the new sections:
	1.	Updated main.mo (with user queue data structures and methods).
	2.	New React Hook (useUserQueueFeed.ts) for infinite pagination of a user queue.
	3.	Example Page (queue.tsx) displaying a user’s personal queue in a TikTok-like feed.

1. Existing Files (Unmodified)

1.1. Backend: bitobytes_backend/main.mo

<details>
<summary><strong><code>main.mo</code></strong> (Original Code)</summary>


import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Hash "mo:base/Hash";
import Array "mo:base/Array";

actor {
  /*************************************************
   * Video Types & Logic (already present)
   *************************************************/
  public type Video = {
    id: Nat64;
    uploader: Principal;
    title: Text;
    mediaRef: Text;
    thumbnailCid: Text;
    hlsCid: Text;
    duration: Nat;
    likes: Nat;
    views: Nat; // Add view count field
    timestamp: Int;
  };

  // Storage for videos
  private stable var nextId: Nat64 = 0;
  private var videos = HashMap.HashMap<Nat64, Video>(
    0,
    Nat64.equal,
    func(n: Nat64) : Hash.Hash { Hash.hash(Nat64.toNat(n)) }
  );

  // Method to add a new video
  public shared(msg) func addVideo(
    title: Text,
    mediaRef: Text,
    thumbnailCid: Text,
    hlsCid: Text,
    duration: Nat
  ) : async Nat64 {
    let videoId = nextId;
    let video: Video = {
      id = videoId;
      uploader = msg.caller;
      title = title;
      mediaRef = mediaRef;
      thumbnailCid = thumbnailCid;
      hlsCid = hlsCid;
      duration = duration;
      likes = 0;
      views = 0; // Initialize views to 0
      timestamp = Time.now();
    };
    
    videos.put(videoId, video);
    nextId += 1;
    
    return videoId;
  };

  // Method to get all videos
  public query func getVideos() : async [Video] {
    return Iter.toArray(videos.vals());
  };

  // Method to like a video
  public func likeVideo(videoId: Nat64) : async Bool {
    switch (videos.get(videoId)) {
      case (null) {
        return false; // Video not found
      };
      case (?video) {
        let updatedVideo: Video = {
          id = video.id;
          uploader = video.uploader;
          title = video.title;
          mediaRef = video.mediaRef;
          thumbnailCid = video.thumbnailCid;
          hlsCid = video.hlsCid;
          duration = video.duration;
          likes = video.likes + 1;
          views = video.views;
          timestamp = video.timestamp;
        };
        videos.put(videoId, updatedVideo);
        return true;
      };
    }
  };

  // Method to get a single video by ID
  public query func getVideo(videoId: Nat64) : async ?Video {
    return videos.get(videoId);
  };

  // Method to increment view count
  public func incrementViewCount(videoId: Nat64) : async Bool {
    switch (videos.get(videoId)) {
      case (null) {
        return false; // Video not found
      };
      case (?video) {
        let updatedVideo: Video = {
          id = video.id;
          uploader = video.uploader;
          title = video.title;
          mediaRef = video.mediaRef;
          thumbnailCid = video.thumbnailCid;
          hlsCid = video.hlsCid;
          duration = video.duration;
          likes = video.likes;
          views = video.views + 1; // Increment view count
          timestamp = video.timestamp;
        };
        videos.put(videoId, updatedVideo);
        return true;
      };
    }
  };

  /*************************************************
   * NEW: Profile Types & Logic
   *************************************************/
  public type UserProfile = {
    name: Text;
    avatarUrl: Text;
    owner: Principal;
  };

  // Store profiles by Principal
  private var profiles = HashMap.HashMap<Principal, UserProfile>(
    0,
    Principal.equal,
    Principal.hash
  );

  /**
   * Set (or update) the caller's profile
   */
  public shared(msg) func saveMyProfile(
    name: Text,
    avatarUrl: Text
  ) : async UserProfile {
    let callerPrincipal = msg.caller;
    let profile: UserProfile = {
      name = name;
      avatarUrl = avatarUrl;
      owner = callerPrincipal;
    };
    profiles.put(callerPrincipal, profile);
    return profile;
  };

  /**
   * Get the caller's own profile
   */
  public shared query(msg) func getMyProfile() : async ?UserProfile {
    return profiles.get(msg.caller);
  };

  /**
   * A method to list all profiles
   */
  public query func listProfiles() : async [UserProfile] {
    return Iter.toArray(profiles.vals());
  };

  /**
   * Get only the videos that belong to the caller
   */
  public shared query(msg) func getMyVideos() : async [Video] {
    let callerPrincipal = msg.caller;
    let allVideos = Iter.toArray(videos.vals());
    
    return Array.filter<Video>(allVideos, func (v: Video) : Bool {
      Principal.equal(v.uploader, callerPrincipal)
    });
  };
}

</details>


1.2. Frontend: bitobytes_frontend

Below is the entire Next.js/React frontend structure and code that was provided. Click each file to expand.

<details>
<summary><strong><code>next.config.js</code></strong></summary>


/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // For local development, use local dist
  distDir: 'dist',
  // Comment out static export for development to enable API routes
  // output: 'export',
  images: {
    unoptimized: true,
  },
  // Used for static HTML exports for IC deployment
  trailingSlash: true,
  // Add rewrites for direct API access to the IC replica
  async rewrites() {
    // Determine the host based on environment
    const icHost = process.env.NODE_ENV === 'production' 
      ? 'https://ic0.app' 
      : process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
    
    console.log(`Using IC host for rewrites: ${icHost}`);
    
    return [
      {
        source: '/api/:path*',
        destination: `${icHost}/api/:path*`,
      },
      // Add more specific rewrites with higher priority
      {
        source: '/api/v2/status',
        destination: `${icHost}/api/v2/status`,
      },
      {
        source: '/api/v2/canister/:canisterId/read_state',
        destination: `${icHost}/api/v2/canister/:canisterId/read_state`,
      },
      {
        source: '/api/v3/canister/:canisterId/call',
        destination: `${icHost}/api/v3/canister/:canisterId/call`,
      },
      // Special handling for the management canister
      {
        source: '/api/v2/canister/ryjl3-tyaaa-aaaaa-aaaba-cai/:path*',
        destination: `${icHost}/api/v2/canister/${process.env.NEXT_PUBLIC_SIWE_CANISTER_ID}/:path*`,
      },
    ];
  },
}

export default nextConfig

</details>


<details>
<summary><strong><code>postcss.config.cjs</code></strong></summary>


module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

</details>


<details>
<summary><strong><code>tailwind.config.cjs</code></strong></summary>


/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

</details>


<details>
<summary><strong><code>package.json</code></strong></summary>


{
  "name": "bitobytes_frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "export": "next build && rm -rf ../../dist/bitobytes_frontend/* && cp -r dist/* ../../dist/bitobytes_frontend/",
    "generate": "dfx generate",
    "clean": "rm -rf .next dist node_modules"
  },
  "dependencies": {
    "@dfinity/agent": "^2.3.0",
    "@dfinity/auth-client": "^2.3.0",
    "@dfinity/candid": "^2.3.0",
    "@dfinity/identity": "^2.3.0",
    "@dfinity/principal": "^2.3.0",
    "@tanstack/react-query": "^5.66.9",
    "@types/next": "^8.0.7",
    "@wagmi/connectors": "^5.7.8",
    "@wagmi/core": "^2.16.5",
    "@web3modal/ethereum": "^2.7.1",
    "@web3modal/wagmi": "^5.1.11",
    "cbor": "^10.0.3",
    "hls.js": "^1.5.20",
    "ic-siwe-js": "^0.2.4",
    "ipfs-http-client": "^60.0.1",
    "next": "^13.4.19",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "viem": "^2.23.5",
    "wagmi": "^2.14.12"
  },
  "devDependencies": {
    "@types/node": "^20.5.6",
    "@types/react": "^18.2.21",
    "@types/react-dom": "^18.2.7",
    "autoprefixer": "^10.4.15",
    "eslint": "^8.48.0",
    "eslint-config-next": "^13.4.19",
    "postcss": "^8.4.28",
    "tailwindcss": "^3.3.3",
    "typescript": "^5.2.2"
  }
}

</details>


<details>
<summary><strong><code>tsconfig.json</code></strong></summary>


{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "src/types/**/*.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}

</details>


<details>
<summary><strong><code>src/types/next.d.ts</code></strong></summary>


// Type declarations for Next.js modules
declare module 'next/app' {
  import { AppProps as NextAppProps } from 'next/dist/shared/lib/router/router';
  export type AppProps = NextAppProps;
}

declare module 'next/head' {
  import React from 'react';
  export default function Head(props: React.PropsWithChildren<{}>): JSX.Element;
}

declare module 'next/link' {
  import React from 'react';
  
  export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
  }
  
  export default function Link(props: React.PropsWithChildren<LinkProps>): JSX.Element;
}

declare module 'next/router' {
  export interface RouterProps {
    pathname: string;
    query: Record<string, string | string[]>;
    asPath: string;
    push: (url: string, as?: string, options?: any) => Promise<boolean>;
    replace: (url: string, as?: string, options?: any) => Promise<boolean>;
    reload: () => void;
    back: () => void;
    prefetch: (url: string) => Promise<void>;
    beforePopState: (cb: (state: any) => boolean) => void;
    events: {
      on: (event: string, handler: (...args: any[]) => void) => void;
      off: (event: string, handler: (...args: any[]) => void) => void;
      emit: (event: string, ...args: any[]) => void;
    };
    isFallback: boolean;
    isReady: boolean;
  }
  
  export function useRouter(): RouterProps;
}

</details>


<details>
<summary><strong><code>src/index.html</code></strong></summary>


<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BitOBytes - Decentralized Video Platform</title>
  <meta name="description" content="Decentralized TikTok-like platform on the Internet Computer" />
  <link rel="icon" href="/favicon.ico" />
</head>
<body>
  <div id="root"></div>
</body>
</html>

</details>


<details>
<summary><strong><code>src/context/index.tsx</code></strong></summary>


import { AuthContext, useAuth } from './AuthContext';
import { AuthProvider } from './AuthProvider';

// Re-export the AuthContext, useAuth hook, and AuthProvider
export { AuthContext, useAuth, AuthProvider };

</details>


<details>
<summary><strong><code>src/context/AuthContext.tsx</code></strong></summary>


import { createContext, useContext } from 'react';

// Create a context for the SIWE authentication state
export const AuthContext = createContext<{
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}>({
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

</details>


<details>
<summary><strong><code>src/context/AuthProvider.tsx</code></strong></summary>


import React, { ReactNode, useEffect, useState } from 'react';
import { SiweIdentityProvider, useSiwe } from 'ic-siwe-js/react';
import { WagmiProvider } from 'wagmi';
import { config } from '../wagmi/wagmi.config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from './AuthContext';
import dynamic from 'next/dynamic';

// Create a query client for React Query
const queryClient = new QueryClient();

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
  canisterId: string;
}

// Internal provider that uses the SIWE hooks
const InternalAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { 
    identity, 
    login: siweLogin, 
    clear, 
    isInitializing,
    loginStatus,
    prepareLoginStatus,
    isLoginSuccess,
    isLoginError,
    loginError,
    delegationChain
  } = useSiwe();

  // Derived authentication state
  const isAuthenticated = !!identity;
  const isLoading = isInitializing || loginStatus === 'logging-in';

  // Login function that wraps the SIWE login
  const login = async () => {
    try {
      console.log('Starting SIWE login process...');
      console.log('Current login status:', loginStatus);
      console.log('Current prepare login status:', prepareLoginStatus);
      console.log('Has identity:', !!identity);
      console.log('Has delegation chain:', !!delegationChain);
      
      // Call the SIWE login function
      await siweLogin();
      console.log('SIWE login function completed');
    } catch (error) {
      console.error('Login failed:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  };

  // Logout function
  const logout = () => {
    console.log('Logging out...');
    console.log('Current identity:', identity?.getPrincipal().toString());
    clear();
    console.log('Identity cleared');
  };

  // Log authentication state changes
  useEffect(() => {
    console.log('Auth state changed:', {
      isAuthenticated,
      isLoading,
      loginStatus,
      prepareLoginStatus,
      isLoginSuccess,
      isLoginError
    });
    
    if (isLoginSuccess) {
      console.log('Login successful');
      console.log('Identity principal:', identity?.getPrincipal().toString());
      console.log('Delegation chain expiration:', delegationChain?.delegations[0]?.delegation.expiration.toString());
    }
    
    if (isLoginError && loginError) {
      console.error('Login error:', loginError);
      console.error('Login error stack:', loginError.stack);
    }
  }, [isLoginSuccess, isLoginError, loginError, isAuthenticated, isLoading, loginStatus, prepareLoginStatus, identity, delegationChain]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Main provider component that wraps all the necessary providers
const AuthProviderComponent: React.FC<AuthProviderProps> = ({ children, canisterId }) => {
  const host = process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
  
  // Ensure canisterId is available and log it for debugging
  console.log('SIWE canister ID:', canisterId);
  console.log('IC host:', host);
  
  if (!canisterId) {
    console.warn('No canisterId provided to AuthProvider');
  }

  // Setup localStorage debug option for more detailed logging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('debug', 'ic-siwe-js:*');
    }
  }, []);

  // Log when the component mounts and unmounts
  useEffect(() => {
    console.log('AuthProvider mounted');
    return () => {
      console.log('AuthProvider unmounted');
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SiweIdentityProvider
          canisterId={canisterId}
          httpAgentOptions={{
            host,
            verifyQuerySignatures: false,
            fetchOptions: {
              credentials: 'omit',
            },
          }}
        >
          <InternalAuthProvider>
            {children}
          </InternalAuthProvider>
        </SiweIdentityProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

// Export a dynamic version of the AuthProvider that only runs on the client
export const AuthProvider = dynamic<AuthProviderProps>(
  () => Promise.resolve(AuthProviderComponent),
  { ssr: false }
);

</details>


<details>
<summary><strong><code>src/wagmi/is-chain-id-supported.tsx</code></strong></summary>


import { wagmiChains } from './wagmi.config';

/**
 * Checks if a given chain ID is supported by the application
 * @param chainId The chain ID to check
 * @returns boolean indicating if the chain is supported
 */
export function isChainIdSupported(chainId: number): boolean {
  return wagmiChains.some((chain) => chain.id === chainId);
}

</details>


<details>
<summary><strong><code>src/wagmi/wagmi.config.ts</code></strong></summary>


import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// Create wagmi config with supported chains and connectors
export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected({
      shimDisconnect: true, // This helps with MetaMask disconnect issues
    }),
    walletConnect({
      // Using the provided projectId
      // In production, you should use an environment variable
      projectId: '3314f21eac8f71b9c7d0fd4b2ab0db7c',
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});

// Export the configured chains for use in other components
export const wagmiChains = [mainnet, sepolia];

</details>


<details>
<summary><strong><code>src/utils/ipfs.ts</code></strong></summary>


// src/bitobytes_frontend/src/utils/ipfs.ts

/**
 * Utility functions for interacting with IPFS via the local Helia node
 */

// Helia node API URL from environment
const HELIA_API_URL = process.env.NEXT_PUBLIC_HELIA_API_URL || 'http://localhost:3001';

/**
 * Upload a file to IPFS via the local Helia node
 * @param file File to upload
 * @param onProgress Optional callback for progress updates
 * @returns Promise resolving to the IPFS CID
 */
export async function uploadToIpfs(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string> {
  // Create form data with the file
  const formData = new FormData();
  formData.append('video', file);
  
  try {
    // Implement a simple progress simulation since we don't have real progress from fetch
    if (onProgress) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        if (progress > 95) {
          clearInterval(interval);
          progress = 95; // Wait for actual completion to show 100%
        }
        onProgress(progress);
      }, 500);
    }
    
    // Send request to the Helia node
    const response = await fetch(`${HELIA_API_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to upload to IPFS: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    
    // Upload complete - set progress to 100%
    if (onProgress) onProgress(100);
    
    return data.cid;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw error;
  }
}

/**
 * Get the URL for accessing content from IPFS
 * @param cid IPFS CID of the content
 * @param path Optional path within a directory
 * @returns URL to access the content
 */
export function getIpfsUrl(cid: string, path?: string): string {
  if (!cid) return '';
  
  if (path) {
    return `${HELIA_API_URL}/ipfs/${cid}/${path}`;
  }
  return `${HELIA_API_URL}/ipfs/${cid}`;
}

/**
 * Get the URL for accessing HLS content from IPFS
 * @param hlsCid IPFS CID of the HLS directory or master.m3u8 file
 * @returns URL to access the HLS master playlist
 */
export function getHlsUrl(hlsCid: string): string {
  if (!hlsCid) return '';
  
  // First try to access the CID directly (in case it's the master.m3u8 file)
  // If that fails, the VideoPlayer will fall back to the original video
  return `${HELIA_API_URL}/ipfs/${hlsCid}`;
}

/**
 * Generate a thumbnail from a video file
 * @param videoFile Video file to generate thumbnail from
 * @returns Promise resolving to a Blob containing the thumbnail image
 */
export async function generateVideoThumbnail(videoFile: File): Promise<Blob> {
  // Create a video element to load the file
  const video = document.createElement('video');
  const videoUrl = URL.createObjectURL(videoFile);
  
  return new Promise((resolve, reject) => {
    video.onloadeddata = async () => {
      try {
        // Seek to 25% of the video duration for the thumbnail
        video.currentTime = video.duration * 0.25;
      } catch (error) {
        URL.revokeObjectURL(videoUrl);
        reject(error);
      }
    };
    
    video.onseeked = () => {
      try {
        // Create a canvas to draw the thumbnail
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the video frame to the canvas
        const ctx = canvas.getContext('2d');
        ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Clean up the video element
        URL.revokeObjectURL(videoUrl);
        
        // Convert the canvas to a blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        }, 'image/jpeg', 0.8);
      } catch (error) {
        URL.revokeObjectURL(videoUrl);
        reject(error);
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Error loading video'));
    };
    
    // Load the video
    video.src = videoUrl;
    video.load();
  });
}

</details>


<details>
<summary><strong><code>src/utils/agent.ts</code></strong></summary>


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

</details>


<details>
<summary><strong><code>src/utils/canisterUtils.ts</code></strong></summary>


import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// When deploying locally, we'll need to create this manually after "dfx generate"
// For now, we'll define the interface for TypeScript
export interface Video {
  id: bigint;
  uploader: Principal;
  title: string;
  mediaRef: string;
  thumbnailCid: string;
  hlsCid: string;
  duration: bigint;
  likes: bigint;
  views: bigint;
  timestamp: bigint;
}

export interface UserProfile {
  name: string;
  avatarUrl: string;
  owner: Principal;
}

export interface BitobytesBackend {
  // Existing video methods
  addVideo: (
    title: string,
    mediaRef: string,
    thumbnailCid: string,
    hlsCid: string,
    duration: number
  ) => Promise<bigint>;
  getVideos: () => Promise<Video[]>;
  likeVideo: (videoId: bigint) => Promise<boolean>;
  
  // New video methods
  getVideo: (videoId: bigint) => Promise<Video | null>;
  incrementViewCount: (videoId: bigint) => Promise<boolean>;
  
  // Profile methods
  saveMyProfile: (name: string, avatarUrl: string) => Promise<UserProfile>;
  getMyProfile: () => Promise<UserProfile | null>; 
  listProfiles: () => Promise<UserProfile[]>;
  getMyVideos: () => Promise<Video[]>;
}

// Will be filled in by dfx generate after deployment
let canisterId: string;
let actor: BitobytesBackend;

export const initializeCanister = async () => {
  // When deploying locally
  const isLocalEnv = process.env.NODE_ENV !== 'production';
  
  try {
    const host = isLocalEnv ? 'http://localhost:4943' : 'https://ic0.app';
    const agent = new HttpAgent({ host });
    
    // When running locally, we need to fetch the root key
    if (isLocalEnv) {
      await agent.fetchRootKey();
    }

    // Use the correct canister ID from deployment
    canisterId = process.env.NEXT_PUBLIC_BACKEND_CANISTER_ID || '';
    
    // Once we have generated declarations, we'll replace this with properly typed Actor
    actor = Actor.createActor<BitobytesBackend>(
      ({ IDL }) => {
        const Video = IDL.Record({
          'id': IDL.Nat64,
          'uploader': IDL.Principal,
          'title': IDL.Text,
          'mediaRef': IDL.Text,
          'thumbnailCid': IDL.Text,
          'hlsCid': IDL.Text,
          'duration': IDL.Nat,
          'likes': IDL.Nat,
          'views': IDL.Nat,
          'timestamp': IDL.Int,
        });
        
        const UserProfile = IDL.Record({
          'name': IDL.Text,
          'avatarUrl': IDL.Text,
          'owner': IDL.Principal,
        });
        
        return IDL.Service({
          // Existing video methods
          'addVideo': IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Nat], [IDL.Nat64], []),
          'getVideos': IDL.Func([], [IDL.Vec(Video)], ['query']),
          'likeVideo': IDL.Func([IDL.Nat64], [IDL.Bool], []),
          
          // New video methods
          'getVideo': IDL.Func([IDL.Nat64], [IDL.Opt(Video)], ['query']),
          'incrementViewCount': IDL.Func([IDL.Nat64], [IDL.Bool], []),
          
          // Profile methods
          'saveMyProfile': IDL.Func([IDL.Text, IDL.Text], [UserProfile], []),
          'getMyProfile': IDL.Func([], [IDL.Opt(UserProfile)], ['query']),
          'listProfiles': IDL.Func([], [IDL.Vec(UserProfile)], ['query']),
          'getMyVideos': IDL.Func([], [IDL.Vec(Video)], ['query']),
        });
      },
      { agent, canisterId }
    );
    
    return actor;
  } catch (error) {
    console.error('Error initializing canister:', error);
    throw error;
  }
};

export const getBackendActor = async (): Promise<BitobytesBackend> => {
  if (!actor) {
    await initializeCanister();
  }
  return actor;
};

/**
 * Like a video by its ID
 * @param videoId The ID of the video to like
 * @returns Promise resolving to a boolean indicating success
 */
export async function likeVideo(videoId: bigint): Promise<boolean> {
  try {
    const actor = await getBackendActor();
    return await actor.likeVideo(videoId);
  } catch (error) {
    console.error('Error liking video:', error);
    throw error;
  }
}

</details>


<details>
<summary><strong><code>src/utils/rootKeyFetch.ts</code></strong></summary>


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
          // Prevent recursive calls by checking if we're already fetching the root key
          if (!fetchingRootKey && rootKeyFetched === false) {
            fetchingRootKey = true;
            try {
              if (rootKeyPromise === null) {
                await ensureRootKey();
              } else if (rootKeyPromise) {
                await rootKeyPromise;
              }
            } finally {
              fetchingRootKey = false;
            }
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

</details>


<details>
<summary><strong><code>src/styles/globals.css</code></strong></summary>


@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body {
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

* {
  box-sizing: border-box;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.button {
  background-color: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.button:hover {
  background-color: #2563eb;
}

.video-list {
  margin-top: 2rem;
}

.video-item {
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
}

</details>


<details>
<summary><strong><code>src/components/VideoUploadForm.tsx</code></strong></summary>


// src/bitobytes_frontend/src/components/VideoUploadForm.tsx

import React, { useState, useRef } from 'react';
import { getBackendActor } from '../utils/canisterUtils';
import { uploadToIpfs, generateVideoThumbnail } from '../utils/ipfs';

const MAX_VIDEO_SIZE_MB = 100; // Increased limit since we're using our own node
const MAX_VIDEO_DURATION_SEC = 300; //d 5 minutes

interface VideoUploadFormProps {
  onSuccess?: (videoId: bigint) => void;
  onError?: (error: string) => void;
}

const VideoUploadForm: React.FC<VideoUploadFormProps> = ({ onSuccess, onError }) => {
  const [title, setTitle] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingHls, setProcessingHls] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Handle video file selection
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setVideoFile(null);
      setDuration(0);
      return;
    }
    
    const file = files[0];
    const fileSizeMB = file.size / (1024 * 1024);
    
    // Check file size
    if (fileSizeMB > MAX_VIDEO_SIZE_MB) {
      setErrorMsg(`Video size (${fileSizeMB.toFixed(2)}MB) exceeds the maximum allowed (${MAX_VIDEO_SIZE_MB}MB)`);
      e.target.value = '';
      return;
    }
    
    // Reset error message
    setErrorMsg('');
    setVideoFile(file);
    
    // Get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      if (video.duration > MAX_VIDEO_DURATION_SEC) {
        setErrorMsg(`Video duration (${video.duration.toFixed(1)}s) exceeds the maximum allowed (${MAX_VIDEO_DURATION_SEC}s)`);
        setVideoFile(null);
        e.target.value = '';
      } else {
        setDuration(video.duration);
        
        // Automatically generate thumbnail if not manually selected
        if (!thumbnailFile) {
          generateVideoThumbnail(file)
            .then(thumbnailBlob => {
              const thumbnailFile = new File([thumbnailBlob], `${file.name}-thumbnail.jpg`, { type: 'image/jpeg' });
              setThumbnailFile(thumbnailFile);
            })
            .catch(err => {
              console.error('Error generating thumbnail:', err);
              // Continue without thumbnail if generation fails
            });
        }
      }
    };
    video.src = URL.createObjectURL(file);
  };
  
  // Handle thumbnail file selection
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setThumbnailFile(null);
      return;
    }
    
    setThumbnailFile(files[0]);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!videoFile) {
      setErrorMsg('Please select a video to upload');
      return;
    }
    
    if (!title) {
      setErrorMsg('Please enter a title for the video');
      return;
    }
    
    setErrorMsg('');
    setUploading(true);
    setProcessingStep('Uploading video to IPFS...');
    
    try {
      // Upload video to IPFS via Helia
      // The server will process the video for HLS streaming
      const formData = new FormData();
      formData.append('video', videoFile);
      
      // Simulate progress updates
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
        if (progress > 95) {
          clearInterval(progressInterval);
          progress = 95; // Wait for actual completion to show 100%
        }
        setUploadProgress(progress);
      }, 500);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_HELIA_API_URL || 'http://localhost:3001'}/upload`, {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to upload to IPFS: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Upload failed');
      }
      
      const videoCid = data.cid;
      const hlsCid = data.hlsCid || '';
      
      console.log('Video uploaded with CID:', videoCid);
      console.log('HLS content CID:', hlsCid || 'Not available');
      
      // Upload thumbnail to IPFS if available
      setProcessingStep('Processing thumbnail...');
      let thumbnailCid = '';
      if (thumbnailFile) {
        // Use the utility function for thumbnail upload
        thumbnailCid = await uploadToIpfs(thumbnailFile);
      }
      
      // Store metadata in the canister
      setProcessingStep('Storing metadata...');
      const actor = await getBackendActor();
      const videoId = await actor.addVideo(
        title,
        videoCid,        // mediaRef (IPFS CID for original video)
        thumbnailCid,    // IPFS CID for thumbnail
        hlsCid,          // IPFS CID for HLS content
        Math.round(duration)
      );
      
      console.log('Video metadata stored successfully:', videoId.toString());
      
      // Clear form after successful upload
      setTitle('');
      setVideoFile(null);
      setThumbnailFile(null);
      setUploadProgress(0);
      setProcessingStep('');
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(videoId);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMsg(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Call error callback if provided
      if (onError) {
        onError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setUploading(false);
      setProcessingHls(false);
      setProcessingStep('');
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Upload Video</h2>
      
      {errorMsg && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMsg}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="title" className="block text-gray-700 font-medium mb-2">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={uploading}
            placeholder="Enter video title"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="video" className="block text-gray-700 font-medium mb-2">
            Video File
          </label>
          <input
            type="file"
            id="video"
            onChange={handleVideoChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            accept="video/*"
            disabled={uploading}
            required
          />
          {videoFile && (
            <div className="mt-2 text-sm text-gray-600">
              <p>File: {videoFile.name}</p>
              <p>Size: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              <p>Duration: {duration.toFixed(1)} seconds</p>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Maximum size: {MAX_VIDEO_SIZE_MB}MB, Maximum duration: {MAX_VIDEO_DURATION_SEC} seconds
          </p>
        </div>
        
        <div className="mb-4">
          <label htmlFor="thumbnail" className="block text-gray-700 font-medium mb-2">
            Thumbnail Image (Optional)
          </label>
          <input
            type="file"
            id="thumbnail"
            onChange={handleThumbnailChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            accept="image/*"
            disabled={uploading}
          />
          {thumbnailFile && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">Thumbnail: {thumbnailFile.name}</p>
              <img 
                src={URL.createObjectURL(thumbnailFile)} 
                alt="Thumbnail preview" 
                className="mt-2 h-24 object-cover rounded"
              />
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            If not provided, a thumbnail will be generated automatically
          </p>
        </div>
        
        {uploading && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {processingStep || `Uploading: ${uploadProgress}% complete`}
            </p>
          </div>
        )}
        
        <button
          type="submit"
          disabled={uploading || !videoFile || !title}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {uploading ? 'Processing...' : 'Upload Video'}
        </button>
      </form>
    </div>
  );
};

export default VideoUploadForm;

</details>


<details>
<summary><strong><code>src/components/VideoPlayer.tsx</code></strong></summary>


import React, { useEffect, useRef, useState } from 'react';
import { getHlsUrl, getIpfsUrl } from '../utils/ipfs';
import { likeVideo } from '../utils/canisterUtils';

interface VideoPlayerProps {
  videoId: bigint;
  title: string;
  mediaRef: string;
  thumbnailCid: string;
  hlsCid: string;
  duration: number;
  likes: number;
  views: number;
  onLike?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  title,
  mediaRef,
  thumbnailCid,
  hlsCid,
  duration,
  likes,
  views,
  onLike
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(isNaN(likes) ? 0 : likes);
  const [isLiked, setIsLiked] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    // Check if user has liked the video
    if (videoId) {
      const hasLiked = localStorage.getItem(`liked-${videoId.toString()}`);
      if (hasLiked) {
        setIsLiked(true);
      }
    }
  }, [videoId]);

  // Log props for debugging
  useEffect(() => {
    console.log('VideoPlayer props:', {
      videoId: videoId ? videoId.toString() : 'undefined',
      title,
      mediaRef,
      thumbnailCid,
      hlsCid,
      duration,
      likes,
      views
    });
  }, [videoId, title, mediaRef, thumbnailCid, hlsCid, duration, likes, views]);

  // Handle video source selection - try HLS first, then fall back to direct video
  const videoSource = hlsCid 
    ? getHlsUrl(hlsCid)
    : (mediaRef ? getIpfsUrl(mediaRef) : '');
  
  console.log('Video source URL:', videoSource);
  console.log('HLS CID:', hlsCid);
  console.log('Media Ref:', mediaRef);
  
  // For debugging
  if (hlsCid) {
    // Try to fetch the HLS content to see if it's accessible
    fetch(videoSource)
      .then(response => {
        console.log('HLS content fetch status:', response.status);
        if (!response.ok) {
          console.warn('HLS content not accessible, will fall back to direct video');
        }
      })
      .catch(error => {
        console.error('Error fetching HLS content:', error);
      });
  }

  // Handle thumbnail
  const thumbnailUrl = thumbnailCid 
    ? getIpfsUrl(thumbnailCid) 
    : '/placeholder-thumbnail.jpg';
  
  console.log('Thumbnail URL:', thumbnailUrl);

  // Format duration
  const formatDuration = (seconds: number) => {
    if (isNaN(seconds)) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Format view count
  const formatViews = (count: number) => {
    if (isNaN(count)) {
      return '0';
    } else if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toString();
    }
  };

  // Handle video play/pause
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Could not play video. Please try again.');
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle like button click
  const handleLike = async () => {
    if (!isLiked && videoId) {
      try {
        // Call the backend to like the video
        const success = await likeVideo(videoId);
        if (success) {
          setLikeCount(prev => prev + 1);
          setIsLiked(true);
          localStorage.setItem(`liked-${videoId.toString()}`, 'true');
          if (onLike) onLike();
        }
      } catch (err) {
        console.error('Error liking video:', err);
      }
    }
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Handle video error
  const handleVideoError = () => {
    console.error('Video playback error. Source:', videoRef.current?.src);
    
    // If we're already using the direct video and it failed, show an error
    if (usingFallback || !mediaRef) {
      console.error('Direct video playback failed');
      setError('Failed to load video. Please try again later.');
      setLoading(false);
      return;
    }
    
    // If we're using HLS and it failed, try the direct video
    if (!usingFallback && mediaRef) {
      console.log('Falling back to direct video');
      setUsingFallback(true);
      if (videoRef.current) {
        const directUrl = getIpfsUrl(mediaRef);
        console.log('Setting fallback URL:', directUrl);
        videoRef.current.src = directUrl;
        videoRef.current.load(); // Force reload with new source
        
        // Add a curl check to debug the HLS URL
        if (hlsCid) {
          const hlsUrl = getHlsUrl(hlsCid);
          console.log(`HLS URL that failed: ${hlsUrl}`);
          console.log(`Try checking this URL with: curl -I ${hlsUrl}`);
        }
      }
    } else {
      setError('Failed to load video. Please try again later.');
      setLoading(false);
    }
  };

  return (
    <div className="video-player rounded-lg overflow-hidden bg-gray-900">
      {/* Video container */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={usingFallback ? getIpfsUrl(mediaRef) : videoSource}
          poster={thumbnailUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadStart={() => setLoading(true)}
          onLoadedData={() => {
            setLoading(false);
            console.log('Video loaded successfully:', videoRef.current?.src);
          }}
          onError={handleVideoError}
          controls
        />
        
        {/* Loading indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white bg-red-600 px-4 py-2 rounded">
              {error}
            </div>
          </div>
        )}
        
        {/* Fallback indicator */}
        {usingFallback && !error && !loading && (
          <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded">
            Playing original video
          </div>
        )}
      </div>
      
      {/* Video info */}
      <div className="p-4 bg-white">
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        
        <div className="flex justify-between items-center mb-4">
          <div className="text-gray-600 text-sm">
            {formatViews(views)} views • {formatDuration(duration)}
          </div>
          
          <div className="flex items-center">
            <button 
              onClick={handleLike}
              className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
                isLiked ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200'
              }`}
              disabled={isLiked}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                viewBox="0 0 20 20" 
                fill={isLiked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={isLiked ? "0" : "1.5"}
              >
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              <span>{likeCount}</span>
            </button>
            
            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: title,
                    text: `Check out this video: ${title}`,
                    url: window.location.href,
                  })
                  .catch((error) => console.log('Error sharing:', error));
                } else {
                  // Fallback for browsers that don't support the Web Share API
                  navigator.clipboard.writeText(window.location.href)
                    .then(() => alert('Link copied to clipboard!'))
                    .catch(err => console.error('Could not copy link:', err));
                }
              }}
              className="flex items-center space-x-1 px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 ml-2"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                viewBox="0 0 20 20" 
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
              <span>Share</span>
            </button>
          </div>
        </div>
        
        {/* Video details/description would go here */}
        <div className="text-sm text-gray-700 mt-4 pt-4 border-t">
          <p>Video ID: {videoId ? videoId.toString() : 'N/A'}</p>
          <p className="truncate">IPFS CID: {mediaRef || 'N/A'}</p>
          {hlsCid && <p className="truncate">HLS CID: {hlsCid}</p>}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;

</details>


<details>
<summary><strong><code>src/components/Navigation.tsx</code></strong></summary>


import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const Navigation: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  // Check if the current route matches the given path
  const isActive = (path: string) => router.pathname === path;

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="text-xl font-bold">
            BitOBytes
          </Link>
          
          <div className="ml-8 flex space-x-4">
            <Link 
              href="/" 
              className={`hover:text-blue-300 ${isActive('/') ? 'text-blue-300' : ''}`}
            >
              Home
            </Link>
            
            {isAuthenticated && (
              <>
                <Link 
                  href="/profile" 
                  className={`hover:text-blue-300 ${isActive('/profile') ? 'text-blue-300' : ''}`}
                >
                  Profile
                </Link>
                <Link 
                  href="/allProfiles" 
                  className={`hover:text-blue-300 ${isActive('/allProfiles') ? 'text-blue-300' : ''}`}
                >
                  All Profiles
                </Link>
                <Link 
                  href="/upload" 
                  className={`hover:text-blue-300 ${isActive('/upload') ? 'text-blue-300' : ''}`}
                >
                  Upload Video
                </Link>
              </>
            )}
          </div>
        </div>
        
        <div>
          {isAuthenticated ? (
            <button 
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              Sign Out
            </button>
          ) : (
            <Link 
              href="/signin" 
              className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded ${isActive('/signin') ? 'bg-blue-700' : ''}`}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

</details>


<details>
<summary><strong><code>src/components/login/LoginPage.tsx</code></strong></summary>


import React, { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import ConnectButton from './ConnectButton';
import LoginButton from './LoginButton';

const LoginPage: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { signMessageAsync, isPending, error } = useSignMessage();
  const [testSignResult, setTestSignResult] = useState<string | null>(null);
  const [testSignError, setTestSignError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('');

  // Update connection status when isConnected changes
  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('Connected to wallet');
    } else {
      setConnectionStatus('');
    }
  }, [isConnected]);

  // Function to test signing a message
  const handleTestSign = async () => {
    if (!isConnected || !address) {
      setTestSignError('Please connect your wallet first');
      return;
    }

    setTestSignResult(null);
    setTestSignError(null);

    try {
      // Create a test message with timestamp to make it unique
      const message = `Test signing with address ${address} at ${new Date().toISOString()}`;
      
      // Sign the message
      const signature = await signMessageAsync({ message });
      
      // Display the result
      setTestSignResult(`Message signed successfully! Signature: ${signature.slice(0, 20)}...`);
    } catch (err) {
      console.error('Test sign error:', err);
      setTestSignError(`Failed to sign message: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
      <h1 className="text-3xl font-bold mb-10 text-center">Sign in with Ethereum</h1>
      
      {connectionStatus && (
        <div className="mb-6 text-green-600 font-medium">
          {connectionStatus}
        </div>
      )}
      
      <div className="w-full max-w-md flex flex-col items-center space-y-6">
        {/* Connect Wallet Button - Always visible */}
        <div className="w-full max-w-xs">
          <ConnectButton />
        </div>

        {/* Sign In Button - Always visible but may be disabled */}
        <div className="w-full max-w-xs">
          <LoginButton />
        </div>

        {/* Test Sign Button - Always visible but may be disabled */}
        <div className="w-full max-w-xs">
          <button
            onClick={handleTestSign}
            disabled={!isConnected || isPending}
            className="w-full py-3 px-4 bg-white border-2 border-gray-800 hover:bg-gray-100 text-gray-900 font-medium rounded-md text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Signing...' : 'Test Sign'}
          </button>
        </div>
        
        {/* Results and Errors */}
        {testSignResult && (
          <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md w-full max-w-xs">
            {testSignResult}
          </div>
        )}
        
        {(testSignError || error) && (
          <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md w-full max-w-xs">
            {testSignError || error?.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;

</details>


<details>
<summary><strong><code>src/components/login/ConnectButton.module.css</code></strong></summary>


.connect-button-container {
  margin-bottom: 1rem;
}

.connect-button {
  background-color: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.connect-button:hover {
  background-color: #2563eb;
}

.connect-button:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.wallet-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.address-display {
  font-family: monospace;
  padding: 0.25rem 0.5rem;
  background-color: #f3f4f6;
  border-radius: 0.25rem;
  display: inline-block;
}

.disconnect-button {
  background-color: #ef4444;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
  width: fit-content;
}

.disconnect-button:hover {
  background-color: #dc2626;
}

.unsupported-chain-warning {
  color: #ef4444;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.connect-error {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

</details>


<details>
<summary><strong><code>src/components/login/LoginButton.tsx</code></strong></summary>


import React, { useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useSiwe } from 'ic-siwe-js/react';
import { isChainIdSupported } from '../../wagmi/is-chain-id-supported';

const LoginButton: React.FC = () => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { 
    login, 
    isLoggingIn, 
    isPreparingLogin, 
    loginError,
    prepareLoginStatus,
    loginStatus,
    identity,
    delegationChain
  } = useSiwe();

  // Log errors for debugging
  useEffect(() => {
    if (loginError) {
      console.error('Login error:', loginError);
      console.error('Login error stack:', loginError.stack);
    }
  }, [loginError]);

  // Log SIWE state for debugging
  useEffect(() => {
    console.log('SIWE State:', { 
      isConnected, 
      chainId,
      isLoggingIn,
      isPreparingLogin,
      prepareLoginStatus,
      loginStatus,
      hasIdentity: !!identity,
      hasDelegationChain: !!delegationChain
    });
  }, [isConnected, chainId, isLoggingIn, isPreparingLogin, prepareLoginStatus, loginStatus, identity, delegationChain]);

  // Enhanced login function with more logging
  const handleLogin = async () => {
    try {
      console.log('Starting login process...');
      console.log('Current chain ID:', chainId);
      console.log('Is chain supported:', isChainIdSupported(chainId));
      console.log('Is connected:', isConnected);
      console.log('Prepare login status:', prepareLoginStatus);
      console.log('Login status:', loginStatus);
      
      // Call the login function
      console.log('Calling login function...');
      await login();
      console.log('Login function completed');
    } catch (error) {
      console.error('Login function threw an error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }
  };

  // Button text based on state
  const text = () => {
    if (isLoggingIn) {
      return "Signing in";
    }
    if (isPreparingLogin) {
      return "Preparing";
    }
    return "Sign Wallet";
  };

  // Determine button state
  const disabled =
    !isChainIdSupported(chainId) ||
    isLoggingIn ||
    !isConnected ||
    isPreparingLogin;

  return (
    <div className="w-full">
      <button
        onClick={handleLogin}
        disabled={disabled}
        className="w-full py-3 px-4 bg-white border-2 border-gray-800 hover:bg-gray-100 text-gray-900 font-medium rounded-md text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {text()}
      </button>

      {loginError && (
        <div className="mt-2 text-red-600 text-sm">
          Error: {loginError.message}
        </div>
      )}

      {!isChainIdSupported(chainId) && (
        <div className="mt-2 text-yellow-600 text-sm">
          Please switch to a supported network to sign in.
        </div>
      )}
    </div>
  );
};

export default LoginButton;

</details>


<details>
<summary><strong><code>src/components/login/ConnectButton.tsx</code></strong></summary>


import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { isChainIdSupported } from '../../wagmi/is-chain-id-supported';

const ConnectButton: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, error, isPending: isLoading } = useConnect();
  const { disconnect } = useDisconnect();

  // Log available connectors on component mount
  useEffect(() => {
    console.log('Available connectors:', connectors.map(c => ({ name: c.name, ready: c.ready })));
  }, [connectors]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      // Specifically look for the injected connector (MetaMask)
      const injectedConnector = connectors.find(c => c.name === 'Injected');
      
      if (injectedConnector) {
        console.log('Connecting with MetaMask...');
        await connect({ connector: injectedConnector });
      } else {
        console.error('MetaMask connector not found');
        // Try any available connector as fallback
        const anyConnector = connectors.find(c => c.ready);
        if (anyConnector) {
          console.log('Connecting with fallback connector:', anyConnector.name);
          await connect({ connector: anyConnector });
        } else {
          console.error('No ready connectors found');
        }
      }
    } catch (err) {
      console.error('Connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // Check if the connected chain is supported
  const isUnsupportedChain = chainId ? !isChainIdSupported(chainId) : false;

  return (
    <div className="w-full">
      {!isConnected ? (
        <button
          onClick={handleConnect}
          disabled={isLoading || isConnecting}
          className="w-full py-3 px-4 bg-white border-2 border-gray-800 hover:bg-gray-100 text-gray-900 font-medium rounded-md text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading || isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="w-full">
          {isUnsupportedChain ? (
            <div className="text-red-600 text-sm font-medium mb-2">
              Unsupported network. Please switch to a supported network.
            </div>
          ) : (
            <div className="font-mono bg-gray-100 p-2 rounded-md text-center mb-2">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          )}
          <button 
            onClick={handleDisconnect} 
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md text-center transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
      {error && (
        <div className="mt-2 text-red-600 text-sm">
          {error.message}
        </div>
      )}
    </div>
  );
};

export default ConnectButton;

</details>


<details>
<summary><strong><code>src/AuthGuard.tsx</code></strong></summary>


import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './context/AuthContext';
import dynamic from 'next/dynamic';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard component to protect routes that require authentication
 * Redirects to signin page if user is not authenticated
 */
const AuthGuardComponent: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If authentication is still loading, do nothing
    if (isLoading) return;

    // If not authenticated and not already on the signin page, redirect to signin
    if (!isAuthenticated && router.pathname !== '/signin') {
      router.push('/signin');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p>Loading authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render children
  if (!isAuthenticated) {
    return null;
  }

  // If authenticated, render children
  return <>{children}</>;
};

// Export a dynamic version that only runs on the client
const AuthGuard = dynamic<AuthGuardProps>(
  () => Promise.resolve(AuthGuardComponent),
  { ssr: false }
);

export default AuthGuard;

</details>


<details>
<summary><strong><code>src/pages/index.tsx</code></strong></summary>


import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getBackendActor, Video } from '../utils/canisterUtils';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import { getIpfsUrl } from '../utils/ipfs';
import dynamic from 'next/dynamic';

// Create a client-side only component
const HomeComponent = () => {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Format view count
  const formatViews = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toString();
    }
  };
  
  // Format the timestamp to a readable date
  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000); // Convert nanoseconds to milliseconds
    return date.toLocaleDateString();
  };
  
  // Navigate to video detail page
  const navigateToVideo = (videoId: bigint) => {
    router.push(`/video/${videoId.toString()}`);
  };

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);

    try {
      const backendActor = await getBackendActor();
      const fetchedVideos = await backendActor.getVideos();
      console.log('Fetched videos:', fetchedVideos);
      
      // Log more detailed information about each video
      fetchedVideos.forEach((video, index) => {
        console.log(`Video ${index}:`, {
          id: video.id.toString(),
          title: video.title,
          mediaRef: video.mediaRef,
          thumbnailCid: video.thumbnailCid,
          hlsCid: video.hlsCid,
          duration: video.duration.toString(),
          likes: video.likes.toString(),
          views: video.views.toString(),
          timestamp: video.timestamp.toString()
        });
      });
      
      setVideos(fetchedVideos);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to fetch videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Head>
        <title>BitOBytes - Decentralized Video Platform</title>
        <meta name="description" content="Decentralized TikTok-like platform on the Internet Computer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navigation />

      <div className="container mx-auto px-4">
        <main className="py-8">
          <div className="flex flex-col items-center justify-center mb-8">
            <h1 className="text-3xl font-bold mb-6">BitOBytes</h1>
            
            {isAuthenticated ? (
              <p className="mb-4 text-green-600">You are signed in with Ethereum!</p>
            ) : (
              <p className="mb-4 text-gray-600">Sign in with Ethereum to access all features.</p>
            )}
            
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={fetchVideos}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Fetch Videos'}
            </button>

            {error && (
              <p className="text-red-500 mt-4">{error}</p>
            )}
          </div>

          <div className="video-list">
            <h2 className="text-xl font-semibold mb-4">Videos</h2>
            
            {videos.length === 0 ? (
              <p className="text-gray-500">No videos found. Videos will appear here after fetching.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((video) => (
                  <div 
                    key={video.id.toString()} 
                    className="video-item bg-white shadow-md rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigateToVideo(video.id)}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gray-200">
                      {video.thumbnailCid ? (
                        <img 
                          src={getIpfsUrl(video.thumbnailCid)}
                          alt={video.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-thumbnail.jpg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-300">
                          <span className="text-gray-600">No Thumbnail</span>
                        </div>
                      )}
                      
                      {/* Duration badge */}
                      {video.duration > 0 && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1 py-0.5 rounded">
                          {formatDuration(Number(video.duration))}
                        </div>
                      )}
                    </div>
                    
                    {/* Video info */}
                    <div className="p-4">
                      <h3 className="text-lg font-medium line-clamp-2">{video.title}</h3>
                      <div className="flex justify-between mt-2">
                        <p className="text-sm text-gray-500">
                          {video.views ? formatViews(Number(video.views)) : '0'} views
                        </p>
                        <p className="text-sm text-gray-500 flex items-center">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-4 w-4 mr-1" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                          >
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                          </svg>
                          {video.likes.toString()}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Uploaded on {formatDate(video.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <footer className="mt-8 pt-8 border-t border-gray-200 text-center text-gray-500">
          <p>Powered by Internet Computer</p>
        </footer>
      </div>
    </div>
  );
};

// Export a dynamic version that only runs on the client
export default dynamic(() => Promise.resolve(HomeComponent), { ssr: false });

</details>


<details>
<summary><strong><code>src/pages/video/[id].tsx</code></strong></summary>


import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Navigation from '../../components/Navigation';
import VideoPlayer from '../../components/VideoPlayer';
import { getBackendActor, Video } from '../../utils/canisterUtils';
import { getIpfsUrl } from '../../utils/ipfs';

// Create a client-side only component
const VideoDetailComponent = () => {
  const router = useRouter();
  const { id } = router.query;
  
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);

  useEffect(() => {
    // Fetch the specific video and related videos when the ID is available
    const fetchData = async () => {
      if (!id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('Fetching video with ID:', id);
        const backendActor = await getBackendActor();
        
        // Convert ID string to bigint for the canister call
        let videoId: bigint;
        try {
          videoId = BigInt(id as string);
          console.log('Converted ID to BigInt:', videoId.toString());
          
          // Fetch the specific video
          console.log('Calling backend.getVideo with ID:', videoId.toString());
          const fetchedVideo = await backendActor.getVideo(videoId);
          console.log('Fetched video result:', fetchedVideo);
          
          if (!fetchedVideo) {
            console.error('Video not found for ID:', videoId.toString());
            setError('Video not found');
            setLoading(false);
            return;
          }
          
          // The backend should return a single Video object or null
          // If it's null, we've already handled that above
          // If it's an array (unexpected), extract the first item
          let videoData;
          if (Array.isArray(fetchedVideo)) {
            console.log('Warning: getVideo returned an array instead of a single object');
            if (fetchedVideo.length > 0) {
              videoData = fetchedVideo[0]; // Extract the single object from the array
            } else {
              console.error('Empty video array returned');
              setError('Video data is invalid');
              setLoading(false);
              return;
            }
          } else {
            videoData = fetchedVideo;
          }
          
          // Ensure videoData is a single object, not an array
          console.log('Setting video data:', videoData);
          setVideo(videoData); // This should now always be a single Video object
        } catch (error) {
          const idErr = error as Error;
          console.error('Error converting ID to BigInt:', idErr);
          setError(`Invalid video ID: ${id}. Error: ${idErr.message}`);
          setLoading(false);
          return;
        }
        
        // Increment view count
        try {
          await backendActor.incrementViewCount(videoId);
        } catch (viewErr) {
          console.error('Error incrementing view count:', viewErr);
          // Don't fail the whole page load for this
        }
        
        // Fetch all videos to show related videos
        const allVideos = await backendActor.getVideos();
        
        // Filter out the current video and limit to 5 related videos
        const related = allVideos
          .filter(v => v.id.toString() !== id)
          .slice(0, 5);
        
        setRelatedVideos(related);
      } catch (err) {
        console.error('Error fetching video:', err);
        setError('Failed to load video. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  // Handle video like
  const handleLike = async () => {
    if (!video) return;
    
    try {
      // Refresh the video data to get updated like count
      const backendActor = await getBackendActor();
      const updatedVideo = await backendActor.getVideo(video.id);
      
      if (updatedVideo) {
        // Handle case where updatedVideo is an array (same fix as above)
        if (Array.isArray(updatedVideo) && updatedVideo.length > 0) {
          setVideo(updatedVideo[0]); // Extract the single object from the array
        } else if (!Array.isArray(updatedVideo)) {
          setVideo(updatedVideo);
        }
      }
    } catch (err) {
      console.error('Error refreshing video data after like:', err);
    }
  };
  
  // Format the timestamp to a readable date
  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) / 1000000); // Convert nanoseconds to milliseconds
    return date.toLocaleString();
  };

  return (
    <div>
      <Head>
        <title>{video ? `${video.title} - BitOBytes` : 'Loading Video - BitOBytes'}</title>
        <meta name="description" content={video ? `Watch ${video.title} on BitOBytes` : 'Watch videos on BitOBytes'} />
      </Head>

      <Navigation />

      <div className="container mx-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        ) : video ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main video container - takes 2/3 of the screen on large displays */}
            <div className="lg:col-span-2">
              <VideoPlayer 
                videoId={video.id}
                title={video.title}
                mediaRef={video.mediaRef}
                thumbnailCid={video.thumbnailCid}
                hlsCid={video.hlsCid}
                duration={Number(video.duration)}
                likes={Number(video.likes)}
                views={Number(video.views)}
                onLike={handleLike}
              />

              {/* Video metadata */}
              <div className="mt-4 bg-white p-4 rounded-lg shadow">
                <h2 className="text-2xl font-bold">{video.title}</h2>
                <p className="text-gray-600 text-sm">
                  Uploaded on {video.timestamp ? formatDate(video.timestamp) : 'Unknown date'}
                </p>
                
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-semibold">About this video</h3>
                  <p className="mt-2 text-gray-700">
                    This video was uploaded to the Internet Computer and is stored on IPFS.
                  </p>
                  
                  <div className="mt-4 bg-gray-100 p-2 rounded text-xs font-mono overflow-auto">
                    <p>Video ID: {video.id ? video.id.toString() : 'N/A'}</p>
                    <p>Media CID: {video.mediaRef || 'N/A'}</p>
                    {video.hlsCid && <p>HLS CID: {video.hlsCid}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Related videos sidebar - takes 1/3 of the screen on large displays */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Related Videos</h3>
              
              {relatedVideos.length === 0 ? (
                <p className="text-gray-500">No related videos found.</p>
              ) : (
                <div className="space-y-4">
                  {relatedVideos.map((relatedVideo) => (
                    <div 
                      key={relatedVideo.id ? relatedVideo.id.toString() : 'unknown'} 
                      className="flex bg-white p-2 rounded-lg shadow cursor-pointer hover:bg-gray-50"
                      onClick={() => relatedVideo.id && router.push(`/video/${relatedVideo.id.toString()}`)}
                    >
                      {/* Thumbnail */}
                      <div className="w-40 h-24 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                        {relatedVideo.thumbnailCid ? (
                          <img 
                            src={getIpfsUrl(relatedVideo.thumbnailCid)} 
                            alt={relatedVideo.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder-thumbnail.jpg';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-300">
                            <span className="text-gray-500 text-xs">No Thumbnail</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Video info */}
                      <div className="ml-3 flex flex-col justify-between">
                        <div>
                          <h4 className="font-medium text-sm line-clamp-2">{relatedVideo.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {relatedVideo.views ? `${relatedVideo.views.toString()} views` : 'No views'} • {relatedVideo.likes ? `${relatedVideo.likes.toString()} likes` : '0 likes'}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400">
                          {relatedVideo.timestamp ? formatDate(relatedVideo.timestamp) : 'Unknown date'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            No video ID specified. Please select a video to watch.
          </div>
        )}
      </div>
    </div>
  );
};

// Export a dynamic version that only runs on the client
export default dynamic(() => Promise.resolve(VideoDetailComponent), { ssr: false });

</details>


<details>
<summary><strong><code>src/pages/profile.tsx</code></strong></summary>


import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import AuthGuard from '../AuthGuard';
import dynamic from 'next/dynamic';
import Navigation from '../components/Navigation';

import { useAccount } from 'wagmi';
import { useSiwe } from 'ic-siwe-js/react';
import { Principal } from '@dfinity/principal';
import { getBackendActor, Video, UserProfile } from '../utils/canisterUtils';

/** 
 * A simple "VideoCard" component 
 */
function VideoCard({ video }: { video: Video }) {
  return (
    <div className="border rounded p-4">
      <h3 className="font-semibold">{video.title}</h3>
      <p className="text-sm text-gray-600">Likes: {video.likes.toString()}</p>
      <p className="text-sm">MediaRef: {video.mediaRef}</p>
    </div>
  );
}

/**
 * A simple "EditProfile" form
 */
function EditProfile({
  profile,
  onSaved,
}: {
  profile: UserProfile | null;
  onSaved: (p: UserProfile) => void;
}) {
  const [name, setName] = useState(profile?.name || '');
  const [avatar, setAvatar] = useState(profile?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [imageValid, setImageValid] = useState<boolean | null>(null);
  
  // Function to validate image URL
  const validateImageUrl = (url: string) => {
    if (!url || url.trim() === '') {
      setImageValid(null);
      return;
    }
    
    const img = new Image();
    img.onload = () => setImageValid(true);
    img.onerror = () => setImageValid(false);
    img.src = url;
  };
  
  // Validate image URL when it changes
  useEffect(() => {
    validateImageUrl(avatar);
  }, [avatar]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const actor = await getBackendActor();
      // Create the profile object locally to ensure type safety
      const profileToSave: UserProfile = {
        name,
        avatarUrl: avatar,
        owner: profile?.owner || Principal.anonymous() // Fallback to anonymous if no owner
      };
      
      // Save the profile to the backend
      await actor.saveMyProfile(name, avatar);
      
      // Use our local object for the state update
      onSaved(profileToSave);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="p-4 bg-white rounded shadow-md">
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Name</label>
        <input
          type="text"
          className="border px-2 py-1 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Avatar URL</label>
        <input
          type="text"
          className={`border px-2 py-1 w-full ${imageValid === false ? 'border-red-500' : ''}`}
          value={avatar}
          onChange={(e) => setAvatar(e.target.value)}
          placeholder="Enter a valid image URL"
        />
        {imageValid === false && (
          <p className="text-red-500 text-xs mt-1">
            This URL doesn't seem to be a valid image. Please check the URL.
          </p>
        )}
        {avatar && imageValid === true && (
          <div className="mt-2">
            <p className="text-green-500 text-xs">Image URL is valid!</p>
            <img 
              src={avatar} 
              alt="Avatar preview" 
              className="h-16 w-16 mt-1 rounded object-cover border"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}

const ProfilePage: React.FC = () => {
  const { address } = useAccount();
  const { identity, identityAddress } = useSiwe();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myVideos, setMyVideos] = useState<Video[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!identity) return;

      // 1) Fetch user's profile
      setLoadingProfile(true);
      try {
        const actor = await getBackendActor();
        const result = await actor.getMyProfile();
        // Now result is either a UserProfile or null
        setProfile(result);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoadingProfile(false);
      }

      // 2) Fetch user's own videos
      setLoadingVideos(true);
      try {
        const actor = await getBackendActor();
        const vids = await actor.getMyVideos();
        setMyVideos(vids);
      } catch (err) {
        console.error('Error fetching my videos:', err);
      } finally {
        setLoadingVideos(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [identity]);

  function handleProfileSaved(updated: UserProfile) {
    setProfile(updated);
  }

  return (
    <AuthGuard>
      <>
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Head>
            <title>Profile - BitOBytes</title>
          </Head>

          <h1 className="text-3xl font-bold mb-6">Your Profile</h1>

          {/* Basic info */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Ethereum / IC Info</h2>
            <p className="text-sm text-gray-500 mb-2">
              <strong>Connected ETH Address:</strong> {address}
            </p>
            <p className="text-sm text-gray-500 mb-2">
              <strong>SIWE Identity Address:</strong> {identityAddress}
            </p>
            <p className="text-sm text-gray-500 mb-2">
              <strong>IC Principal:</strong>{' '}
              {identity ? identity.getPrincipal().toString() : 'N/A'}
            </p>
          </div>

          {/* Profile */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">User Profile</h2>
            {loadingProfile ? (
              <p>Loading your profile...</p>
            ) : (
              <EditProfile profile={profile} onSaved={handleProfileSaved} />
            )}
            {profile && (
              <div className="mt-4 p-4 bg-gray-100 rounded">
                <p>
                  <strong>Name:</strong> {profile.name}
                </p>
                <p>
                  <strong>Avatar:</strong>{' '}
                  {profile.avatarUrl && profile.avatarUrl.trim() !== '' ? (
                    <img
                      src={profile.avatarUrl}
                      alt="avatar"
                      className="h-16 w-16 mt-1 rounded"
                      onError={(e) => {
                        console.error('Error loading image:', e);
                        e.currentTarget.style.display = 'none';
                        if (e.currentTarget.parentElement) {
                          e.currentTarget.parentElement.innerHTML += '(image failed to load)';
                        }
                      }}
                    />
                  ) : (
                    '(none)'
                  )}
                </p>
              </div>
            )}
          </div>

          {/* My Videos */}
          <div>
            <h2 className="text-xl font-semibold mb-4">My Uploaded Videos</h2>
            {loadingVideos ? (
              <p>Loading your videos...</p>
            ) : myVideos.length === 0 ? (
              <p>You haven't uploaded any videos yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myVideos.map((v) => (
                  <VideoCard key={v.id.toString()} video={v} />
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    </AuthGuard>
  );
};

// Export a dynamic version so it only runs on the client
export default dynamic(() => Promise.resolve(ProfilePage), { ssr: false });

</details>


<details>
<summary><strong><code>src/pages/upload.tsx</code></strong></summary>


// src/bitobytes_frontend/src/pages/upload.tsx

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';

// Use dynamic import with no SSR for the upload form
const VideoUploadForm = dynamic(() => import('../components/VideoUploadForm'), { ssr: false });

const UploadPage: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // Handle upload success
  const handleUploadSuccess = (videoId: bigint) => {
    setUploadSuccess(true);
    setUploadError('');
    
    // Automatically redirect to home page after a delay
    setTimeout(() => {
      router.push('/');
    }, 3000);
  };
  
  // Handle upload error
  const handleUploadError = (error: string) => {
    setUploadError(error);
    setUploadSuccess(false);
  };
  
  return (
    <div>
      <Head>
        <title>Upload Video - BitOBytes</title>
        <meta name="description" content="Upload videos to BitOBytes" />
      </Head>
      
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Upload Video</h1>
        
        {isLoading ? (
          <div className="text-center py-8">
            <p>Loading...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <p>You need to sign in to upload videos.</p>
            <button
              onClick={() => router.push('/signin')}
              className="mt-2 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Sign In
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {uploadSuccess ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p>Video uploaded successfully! Redirecting to home page...</p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-gray-700">
                  Upload your videos to BitOBytes. Your videos will be stored on IPFS via our
                  local Helia node and will be available to viewers instantly.
                </p>
                
                <VideoUploadForm
                  onSuccess={handleUploadSuccess}
                  onError={handleUploadError}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Use dynamic import with no SSR for the entire page
export default dynamic(() => Promise.resolve(UploadPage), { ssr: false });

</details>


<details>
<summary><strong><code>src/pages/api/v2/status.ts</code></strong></summary>


import type { NextApiRequest, NextApiResponse } from 'next';
import { HttpAgent } from '@dfinity/agent';
import * as cbor from 'cbor';

// This endpoint is required by the ic-siwe-js library to check the status of the Internet Computer
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Create an agent to connect to the local Internet Computer replica
    const agent = new HttpAgent({
      host: process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943',
    });

    // Fetch the root key since we're connecting to a local replica
    if (process.env.DFX_NETWORK !== 'ic') {
      await agent.fetchRootKey();
    }

    // Get the status directly from the agent
    const status = await agent.status();

    // Convert the status to CBOR format
    const cborData = cbor.encode(status);
    
    // Set the content type to application/cbor
    res.setHeader('Content-Type', 'application/cbor');
    res.status(200).send(Buffer.from(cborData));
  } catch (error) {
    console.error('Error fetching IC status:', error);
    res.status(500).json({ error: 'Failed to fetch IC status' });
  }
}

</details>


<details>
<summary><strong><code>src/pages/api/v2/canister/[canisterId]/call.ts</code></strong></summary>


import type { NextApiRequest, NextApiResponse } from 'next';
import { HttpAgent } from '@dfinity/agent';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { canisterId } = req.query;
    
    if (!canisterId || typeof canisterId !== 'string') {
      return res.status(400).json({ error: 'Invalid canister ID' });
    }

    // Log the request details for debugging
    console.log(`[API v2] Processing call request for canister: ${canisterId}`);
    
    // Determine the host based on environment
    const host = process.env.NODE_ENV === 'production'
      ? 'https://ic0.app'
      : process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
    
    console.log(`[API v2] Using host: ${host}`);
    
    const agent = new HttpAgent({ 
      host,
      verifyQuerySignatures: false,
      fetchOptions: {
        credentials: 'omit',
      },
    });

    // Fetch the root key for local development
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      try {
        await agent.fetchRootKey();
        console.log('[API v2] Root key fetched successfully');
      } catch (err) {
        console.error('[API v2] Failed to fetch root key:', err);
        return res.status(500).json({ 
          error: 'Failed to fetch root key',
          message: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Forward the request to the IC
    const url = `${agent.host}/api/v2/canister/${canisterId}/call`;
    console.log(`[API v2] Forwarding request to: ${url}`);
    
    // Check if the canister ID is the management canister
    const siweCanisterId = process.env.NEXT_PUBLIC_SIWE_CANISTER_ID;
    if (canisterId === 'ryjl3-tyaaa-aaaaa-aaaba-cai') {
      console.log(`[API v2] Request is for management canister, redirecting to SIWE provider (${siweCanisterId})`);
      if (!siweCanisterId) {
        console.error('[API v2] NEXT_PUBLIC_SIWE_CANISTER_ID is not set! Cannot redirect management canister request.');
        return res.status(500).json({ 
          error: 'SIWE canister ID not configured',
          message: 'The SIWE canister ID is not set in the environment variables. Please run ./deploy-rust-siwe.sh to deploy the SIWE provider.'
        });
      }
      
      console.log(`[API v2] Redirecting to SIWE canister: ${siweCanisterId}`);
      try {
        const redirectUrl = `${agent.host}/api/v2/canister/${siweCanisterId}/call`;
        console.log(`[API v2] Redirect URL: ${redirectUrl}`);
        
        const response = await fetch(redirectUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/cbor',
          },
          body: req.body,
        });
        
        // Log the response status
        console.log(`[API v2] Redirected response status: ${response.status}`);
        
        // Get the response data
        const data = await response.arrayBuffer();
        
        // Set the content type to match the response
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/cbor');
        
        // Send the response
        return res.status(response.status).send(Buffer.from(data));
      } catch (error) {
        console.error('[API v2] Error redirecting to SIWE canister:', error);
        return res.status(500).json({ 
          error: 'Failed to redirect to SIWE canister',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cbor',
      },
      body: req.body,
    });

    // Log the response status
    console.log(`[API v2] Response status: ${response.status}`);
    
    // If the response is not successful, try to get more details
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not extract error text';
      }
      console.error(`[API v2] Error response: ${errorText}`);
      return res.status(response.status).json({ 
        error: 'Error from IC replica', 
        status: response.status,
        details: errorText
      });
    }

    // Get the response data
    const data = await response.arrayBuffer();
    
    // Set the content type to match the response
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/cbor');
    
    // Send the response
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('[API v2] Error proxying call request:', error);
    res.status(500).json({ 
      error: 'Failed to proxy call request',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

</details>


<details>
<summary><strong><code>src/pages/api/v2/canister/[canisterId]/read_state.ts</code></strong></summary>


import type { NextApiRequest, NextApiResponse } from 'next';
import { HttpAgent } from '@dfinity/agent';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { canisterId } = req.query;
    
    if (!canisterId || typeof canisterId !== 'string') {
      return res.status(400).json({ error: 'Invalid canister ID' });
    }

    // Log the request details for debugging
    console.log(`[API read_state] Processing request for canister: ${canisterId}`);
    
    // Determine the host based on environment
    const host = process.env.NODE_ENV === 'production'
      ? 'https://ic0.app'
      : process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
    
    console.log(`[API read_state] Using host: ${host}`);
    
    const agent = new HttpAgent({ 
      host,
      verifyQuerySignatures: false,
      fetchOptions: {
        credentials: 'omit',
      },
    });

    // Fetch the root key for local development
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      try {
        await agent.fetchRootKey();
        console.log('[API read_state] Root key fetched successfully');
      } catch (err) {
        console.error('[API read_state] Failed to fetch root key:', err);
        return res.status(500).json({ 
          error: 'Failed to fetch root key',
          message: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Forward the request to the IC
    const url = `${agent.host}/api/v2/canister/${canisterId}/read_state`;
    console.log(`[API read_state] Forwarding request to: ${url}`);
    
    // Check if the canister ID is the management canister
    const siweCanisterId = process.env.NEXT_PUBLIC_SIWE_CANISTER_ID;
    if (canisterId === 'ryjl3-tyaaa-aaaaa-aaaba-cai') {
      console.log(`[API read_state] Request is for management canister, redirecting to SIWE provider (${siweCanisterId})`);
      if (!siweCanisterId) {
        console.error('[API read_state] NEXT_PUBLIC_SIWE_CANISTER_ID is not set! Cannot redirect management canister request.');
        return res.status(500).json({ 
          error: 'SIWE canister ID not configured',
          message: 'The SIWE canister ID is not set in the environment variables. Please run ./deploy-rust-siwe.sh to deploy the SIWE provider.'
        });
      }
      
      console.log(`[API read_state] Redirecting to SIWE canister: ${siweCanisterId}`);
      try {
        const redirectUrl = `${agent.host}/api/v2/canister/${siweCanisterId}/read_state`;
        console.log(`[API read_state] Redirect URL: ${redirectUrl}`);
        
        const response = await fetch(redirectUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/cbor',
          },
          body: req.body,
        });
        
        // Log the response status
        console.log(`[API read_state] Redirected response status: ${response.status}`);
        
        // Get the response data
        const data = await response.arrayBuffer();
        
        // Set the content type to match the response
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/cbor');
        
        // Send the response
        return res.status(response.status).send(Buffer.from(data));
      } catch (error) {
        console.error('[API read_state] Error redirecting to SIWE canister:', error);
        return res.status(500).json({ 
          error: 'Failed to redirect to SIWE canister',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cbor',
      },
      body: req.body,
    });

    // Log the response status
    console.log(`[API read_state] Response status: ${response.status}`);
    
    // If the response is not successful, try to get more details
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not extract error text';
      }
      console.error(`[API read_state] Error response: ${errorText}`);
      return res.status(response.status).json({ 
        error: 'Error from IC replica', 
        status: response.status,
        details: errorText
      });
    }

    // Get the response data
    const data = await response.arrayBuffer();
    
    // Set the content type to match the response
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/cbor');
    
    // Send the response
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('[API read_state] Error proxying request:', error);
    res.status(500).json({ 
      error: 'Failed to proxy read_state request',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

</details>


<details>
<summary><strong><code>src/pages/api/v3/canister/[canisterId]/call.ts</code></strong></summary>


import type { NextApiRequest, NextApiResponse } from 'next';
import { HttpAgent } from '@dfinity/agent';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { canisterId } = req.query;
    
    if (!canisterId || typeof canisterId !== 'string') {
      return res.status(400).json({ error: 'Invalid canister ID' });
    }

    // Log the request details for debugging
    console.log(`[API v3] Processing call request for canister: ${canisterId}`);
    
    // Determine the host based on environment
    const host = process.env.NODE_ENV === 'production'
      ? 'https://ic0.app'
      : process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943';
    
    console.log(`[API v3] Using host: ${host}`);
    
    const agent = new HttpAgent({ 
      host,
      verifyQuerySignatures: false,
      fetchOptions: {
        credentials: 'omit',
      },
    });

    // Fetch the root key for local development
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      try {
        await agent.fetchRootKey();
        console.log('[API v3] Root key fetched successfully');
      } catch (err) {
        console.error('[API v3] Failed to fetch root key:', err);
        return res.status(500).json({ 
          error: 'Failed to fetch root key',
          message: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Forward the request to the IC
    const url = `${agent.host}/api/v3/canister/${canisterId}/call`;
    console.log(`[API v3] Forwarding request to: ${url}`);
    
    // Check if the canister ID is the management canister
    const siweCanisterId = process.env.NEXT_PUBLIC_SIWE_CANISTER_ID;
    if (canisterId === 'ryjl3-tyaaa-aaaaa-aaaba-cai') {
      console.log(`[API v3] Request is for management canister, redirecting to SIWE provider (${siweCanisterId})`);
      if (!siweCanisterId) {
        console.error('[API v3] NEXT_PUBLIC_SIWE_CANISTER_ID is not set! Cannot redirect management canister request.');
        return res.status(500).json({ 
          error: 'SIWE canister ID not configured',
          message: 'The SIWE canister ID is not set in the environment variables. Please run ./deploy-rust-siwe.sh to deploy the SIWE provider.'
        });
      }
      
      console.log(`[API v3] Redirecting to SIWE canister: ${siweCanisterId}`);
      try {
        const redirectUrl = `${agent.host}/api/v3/canister/${siweCanisterId}/call`;
        console.log(`[API v3] Redirect URL: ${redirectUrl}`);
        
        const response = await fetch(redirectUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/cbor',
          },
          body: req.body,
        });
        
        // Log the response status
        console.log(`[API v3] Redirected response status: ${response.status}`);
        
        // Get the response data
        const data = await response.arrayBuffer();
        
        // Set the content type to match the response
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/cbor');
        
        // Send the response
        return res.status(response.status).send(Buffer.from(data));
      } catch (error) {
        console.error('[API v3] Error redirecting to SIWE canister:', error);
        return res.status(500).json({ 
          error: 'Failed to redirect to SIWE canister',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cbor',
      },
      body: req.body,
    });

    // Log the response status
    console.log(`[API v3] Response status: ${response.status}`);
    
    // If the response is not successful, try to get more details
    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Could not extract error text';
      }
      console.error(`[API v3] Error response: ${errorText}`);
      return res.status(response.status).json({ 
        error: 'Error from IC replica', 
        status: response.status,
        details: errorText
      });
    }

    // Get the response data
    const data = await response.arrayBuffer();
    
    // Set the content type to match the response
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/cbor');
    
    // Send the response
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('[API v3] Error proxying call request:', error);
    res.status(500).json({ 
      error: 'Failed to proxy v3 call request',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

</details>


<details>
<summary><strong><code>src/pages/_app.tsx</code></strong></summary>


import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../context/index';
import { canisterId } from '../../../ic_siwe_provider/declarations/index';
import { patchFetch } from '../utils/rootKeyFetch';
import { useEffect } from 'react';

// Configure global settings for ic-js
if (typeof window !== 'undefined') {
  // Set up environment variables in the browser
  window.process = {
    ...window.process,
    env: {
      ...window.process?.env,
      NEXT_PUBLIC_SIWE_CANISTER_ID: process.env.NEXT_PUBLIC_SIWE_CANISTER_ID,
      NEXT_PUBLIC_BACKEND_CANISTER_ID: process.env.NEXT_PUBLIC_BACKEND_CANISTER_ID,
      NEXT_PUBLIC_FRONTEND_CANISTER_ID: process.env.NEXT_PUBLIC_FRONTEND_CANISTER_ID,
      NEXT_PUBLIC_IC_HOST: process.env.NEXT_PUBLIC_IC_HOST || 'http://localhost:4943',
    }
  };
  
  // Enable debug logging for ic-siwe-js
  localStorage.setItem('debug', 'ic-siwe-js:*');
}

export default function App({ Component, pageProps }: AppProps) {
  // Use environment variable directly as fallback to ensure consistency
  const siweCanisterId = canisterId || process.env.NEXT_PUBLIC_SIWE_CANISTER_ID || '';
  
  // Apply the fetch patch to ensure root key is fetched, but only on the client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      patchFetch();
    }
  }, []);
  
  if (!siweCanisterId) {
    console.error("WARNING: No SIWE canister ID available. Authentication will not work.");
    console.error("Please run ./deploy-rust-siwe.sh to deploy the SIWE provider and set the environment variable.");
  }
  
  return (
    <AuthProvider canisterId={siweCanisterId}>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

</details>


<details>
<summary><strong><code>src/pages/allProfiles.tsx</code></strong></summary>


import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import AuthGuard from '../AuthGuard';
import dynamic from 'next/dynamic';
import Navigation from '../components/Navigation';
import { getBackendActor, UserProfile } from '../utils/canisterUtils';

function AllProfilesPage() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const actor = await getBackendActor();
        const list = await actor.listProfiles();
        setProfiles(list);
      } catch (err) {
        console.error('Error listing profiles:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AuthGuard>
      <>
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Head>
            <title>All Profiles - BitOBytes</title>
          </Head>
          <h1 className="text-2xl font-bold mb-6">All User Profiles</h1>
          {loading ? (
            <p>Loading...</p>
          ) : profiles.length === 0 ? (
            <p>No profiles found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {profiles.map((p) => (
                <div key={p.owner.toString()} className="border p-4 rounded">
                  <h2 className="font-semibold">{p.name}</h2>
                {p.avatarUrl && p.avatarUrl.trim() !== '' ? (
                  <img
                    src={p.avatarUrl}
                    alt="avatar"
                    className="h-16 w-16 mt-2 rounded"
                    onError={(e) => {
                      console.error('Error loading image:', e);
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.parentElement) {
                        e.currentTarget.parentElement.innerHTML += '(image failed to load)';
                      }
                    }}
                  />
                ) : (
                  <div className="h-16 w-16 mt-2 rounded bg-gray-200 flex items-center justify-center text-gray-500">
                    No Image
                  </div>
                )}
                  <p className="text-sm text-gray-600 mt-2">
                    Principal: {p.owner.toString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    </AuthGuard>
  );
}

export default dynamic(() => Promise.resolve(AllProfilesPage), { ssr: false });

</details>


<details>
<summary><strong><code>src/pages/signin.tsx</code></strong></summary>


import React from 'react';
import Head from 'next/head';
import LoginPage from '../components/login/LoginPage';
import dynamic from 'next/dynamic';

// Create a client-side only component
const SignInComponent = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Head>
        <title>Sign In - BitOBytes</title>
        <meta name="description" content="Sign in to BitOBytes with Ethereum" />
      </Head>

      <main>
        <LoginPage />
      </main>
    </div>
  );
};

// Export a dynamic version that only runs on the client
export default dynamic(() => Promise.resolve(SignInComponent), { ssr: false });

</details>


2. Add a Per-User “Video Queue” + Paginated Feed

Below is a modified main.mo that adds stable data structures and methods for a user-specific queue. Then we show how to call these from the frontend via a new React hook (useUserQueueFeed.ts) and an example page (pages/queue.tsx) that demonstrates infinite pagination.

2.1 Updated main.mo

We keep all the existing code. Then we append new stable variables and methods at the bottom. Here is the complete main.mo with the user queue logic (the new parts are clearly marked).

import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Hash "mo:base/Hash";
import Array "mo:base/Array";

actor {
  /*************************************************
   * Video Types & Logic (already present)
   *************************************************/
  public type Video = {
    id: Nat64;
    uploader: Principal;
    title: Text;
    mediaRef: Text;
    thumbnailCid: Text;
    hlsCid: Text;
    duration: Nat;
    likes: Nat;
    views: Nat; // Add view count field
    timestamp: Int;
  };

  // Storage for videos
  private stable var nextId: Nat64 = 0;
  private var videos = HashMap.HashMap<Nat64, Video>(
    0,
    Nat64.equal,
    func(n: Nat64) : Hash.Hash { Hash.hash(Nat64.toNat(n)) }
  );

  // Method to add a new video
  public shared(msg) func addVideo(
    title: Text,
    mediaRef: Text,
    thumbnailCid: Text,
    hlsCid: Text,
    duration: Nat
  ) : async Nat64 {
    let videoId = nextId;
    let video: Video = {
      id = videoId;
      uploader = msg.caller;
      title = title;
      mediaRef = mediaRef;
      thumbnailCid = thumbnailCid;
      hlsCid = hlsCid;
      duration = duration;
      likes = 0;
      views = 0; // Initialize views to 0
      timestamp = Time.now();
    };
    
    videos.put(videoId, video);
    nextId += 1;
    
    return videoId;
  };

  // Method to get all videos
  public query func getVideos() : async [Video] {
    return Iter.toArray(videos.vals());
  };

  // Method to like a video
  public func likeVideo(videoId: Nat64) : async Bool {
    switch (videos.get(videoId)) {
      case (null) {
        return false; // Video not found
      };
      case (?video) {
        let updatedVideo: Video = {
          id = video.id;
          uploader = video.uploader;
          title = video.title;
          mediaRef = video.mediaRef;
          thumbnailCid = video.thumbnailCid;
          hlsCid = video.hlsCid;
          duration = video.duration;
          likes = video.likes + 1;
          views = video.views;
          timestamp = video.timestamp;
        };
        videos.put(videoId, updatedVideo);
        return true;
      };
    }
  };

  // Method to get a single video by ID
  public query func getVideo(videoId: Nat64) : async ?Video {
    return videos.get(videoId);
  };

  // Method to increment view count
  public func incrementViewCount(videoId: Nat64) : async Bool {
    switch (videos.get(videoId)) {
      case (null) {
        return false; // Video not found
      };
      case (?video) {
        let updatedVideo: Video = {
          id = video.id;
          uploader = video.uploader;
          title = video.title;
          mediaRef = video.mediaRef;
          thumbnailCid = video.thumbnailCid;
          hlsCid = video.hlsCid;
          duration = video.duration;
          likes = video.likes;
          views = video.views + 1; // Increment view count
          timestamp = video.timestamp;
        };
        videos.put(videoId, updatedVideo);
        return true;
      };
    }
  };

  /*************************************************
   * Profile Types & Logic
   *************************************************/
  public type UserProfile = {
    name: Text;
    avatarUrl: Text;
    owner: Principal;
  };

  // Store profiles by Principal
  private var profiles = HashMap.HashMap<Principal, UserProfile>(
    0,
    Principal.equal,
    Principal.hash
  );

  /**
   * Set (or update) the caller's profile
   */
  public shared(msg) func saveMyProfile(
    name: Text,
    avatarUrl: Text
  ) : async UserProfile {
    let callerPrincipal = msg.caller;
    let profile: UserProfile = {
      name = name;
      avatarUrl = avatarUrl;
      owner = callerPrincipal;
    };
    profiles.put(callerPrincipal, profile);
    return profile;
  };

  /**
   * Get the caller's own profile
   */
  public shared query(msg) func getMyProfile() : async ?UserProfile {
    return profiles.get(msg.caller);
  };

  /**
   * A method to list all profiles
   */
  public query func listProfiles() : async [UserProfile] {
    return Iter.toArray(profiles.vals());
  };

  /**
   * Get only the videos that belong to the caller
   */
  public shared query(msg) func getMyVideos() : async [Video] {
    let callerPrincipal = msg.caller;
    let allVideos = Iter.toArray(videos.vals());
    
    return Array.filter<Video>(allVideos, func (v: Video) : Bool {
      Principal.equal(v.uploader, callerPrincipal)
    });
  };

  /*************************************************
   * NEW: Per-User Video Queue & Paginated Feed
   *************************************************/

  // A map from user Principal -> array of video IDs (representing that user’s feed queue).
  private stable var userQueues = HashMap.HashMap<Principal, [Nat64]](
    0,
    Principal.equal,
    Principal.hash
  );

  /**
   * Append a list of video IDs to a user's queue. For example,
   * you might want to add newly recommended videos at the front
   * (so user sees them first).
   */
  public shared(msg) func enqueueVideosForUser(
    user: Principal,
    videoIds: [Nat64]
  ) : async () {
    let currentQueueOpt = userQueues.get(user);

    let newQueue : [Nat64] =
      switch (currentQueueOpt) {
        case null {
          // no existing queue for that user
          videoIds
        };
        case (?existing) {
          // Prepend new videoIds so they appear first
          videoIds # existing
        };
      };

    userQueues.put(user, newQueue);
  };

  /**
   * Returns a chunk (page) of videos from a user's queue in
   * newest-first order. We use a "cursor" approach: The cursor
   * is the last video ID from the previous page. We find where
   * that ID occurs, and return the next chunk of size `limit`.
   *
   * If `cursor` is null, that means "start from the very front."
   *
   * Returns: ( [Video], ?Nat64 ) where the optional Nat64 is
   * the "nextCursor" if more data remains, or null if no more.
   */
  public shared query func getUserQueuePaged(
    user: Principal,
    cursor: ?Nat64,
    limit: Nat
  ) : async ([Video], ?Nat64) {
    let queueOpt = userQueues.get(user);
    if (queueOpt == null) {
      return ([], null); // no queue => no videos
    };

    let queue = queueOpt!;
    var startIndex : Nat = 0;

    // If we have a cursor, find it in the queue
    switch (cursor) {
      case null {
        // no cursor => start from front
      };
      case (?videoId) {
        let idxOpt = findIndex(queue, videoId);
        if (idxOpt != null) {
          startIndex := idxOpt! + 1;
        };
      };
    };

    // slice out [startIndex, startIndex+limit)
    let endIndex = startIndex + limit;
    let sliceIds = Array.sub(queue, startIndex, limit);

    // Convert each ID to a Video
    let sliceVideos = Array.map<Video>(sliceIds, func (vidId: Nat64) : Video {
      // We assume it must exist in the videos map
      switch (videos.get(vidId)) {
        case null {
          // If it's missing, you could skip or handle differently
          // For now, we just fail with ?
          ?("Video not found in canister storage")
        };
        case (?v) { v };
      }
    });

    if (endIndex >= Array.size(queue)) {
      // no more data
      return (sliceVideos, null);
    } else {
      // the last ID in slice is the new cursor
      let nextCursorVal = sliceIds[Array.size(sliceIds) - 1];
      return (sliceVideos, ?nextCursorVal);
    }
  };

  // Helper to find the index of a video ID in the user's queue
  func findIndex(arr: [Nat64], target: Nat64) : ?Nat {
    var i : Nat = 0;
    for (id in arr.vals()) {
      if (id == target) {
        return ?i;
      };
      i += 1;
    };
    return null;
  };
}

Note: This merges your original main.mo with extra logic for userQueues, enqueueVideosForUser, getUserQueuePaged, etc.

2.2 New Hook: useUserQueueFeed.ts

Create a new file in your frontend code, for example at:

bitobytes_frontend
└── src
    └── hooks
        └── useUserQueueFeed.ts

// src/hooks/useUserQueueFeed.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { getBackendActor, Video } from '../utils/canisterUtils';
import { Principal } from '@dfinity/principal';

/**
 * Calls the Motoko method getUserQueuePaged(user, cursor, limit).
 * pageParam is the "cursor" from the last page, or undefined for first page.
 */
async function fetchQueuePage({
  userPrincipal,
  pageParam,
}: {
  userPrincipal: string;
  pageParam?: bigint | null;
}) {
  const actor = await getBackendActor();

  // Convert userPrincipal string => Principal
  const principal = Principal.fromText(userPrincipal);

  // We'll fetch 5 items per page. Adjust as you wish.
  const limit = BigInt(5);

  // If pageParam is undefined, that means we pass Motoko null.
  const cursor = pageParam === undefined ? null : pageParam;

  const [videos, nextCursor] = await actor.getUserQueuePaged(principal, cursor, limit);

  return {
    videos,
    nextCursor,
  };
}

/**
 * React hook for infinite-scrolling a user's personal queue.
 */
export function useUserQueueFeed(userPrincipal: string) {
  return useInfiniteQuery({
    queryKey: ['userQueueFeed', userPrincipal],
    queryFn: ({ pageParam }) =>
      fetchQueuePage({ userPrincipal, pageParam }),
    getNextPageParam: (lastPage) => {
      // If nextCursor is null, no more data
      return lastPage.nextCursor ?? undefined;
    },
  });
}

Explanation:
	•	We call actor.getUserQueuePaged(...), passing in either null (for the first page) or the last cursor from the previous page.
	•	React Query automatically merges pages when you call fetchNextPage.

2.3 Example usage: pages/queue.tsx

Create a new page (like queue.tsx) to demonstrate how you might show the user’s queue with a “Load More” button:

// src/pages/queue.tsx
import React from 'react';
import dynamic from 'next/dynamic';
import { useUserQueueFeed } from '../hooks/useUserQueueFeed';
import { useAccount } from 'wagmi';
import Navigation from '../components/Navigation';
import AuthGuard from '../AuthGuard';

/**
 * Example page showing a user’s personal video feed (infinite scroll).
 * We assume you are authenticated, and thus you have an ETH address
 * and a principal from SIWE. For demonstration, we just call it
 * userPrincipalString. You could get that from useSiwe() or useAuth().
 */
function UserQueuePage() {
  // e.g. from SIWE or from backend. Here we just get the principal from identity or assume a placeholder
  // If you have an IC principal in your AuthProvider, you might do:  const principal = identity?.getPrincipal().toText();
  // For simplicity, let's just pretend we have some string principal:
  // Alternatively, if your bridging code is more direct, you can read it from a React context or from `useSiwe()`.
  // For demonstration, let's say you have a default principal to test with:
  
  const { address } = useAccount();
  // This is NOT necessarily your IC principal. For a real app, you'd store the user’s principal in your AuthContext or fetch from backend.
  // We'll just show how to call the hook.

  // Hard-coded: must be the user’s actual principal. For real usage, replace this with your principal string from SIWE:
  const userPrincipalString = "aaaaa-bbbbbb-cccc-ddddd-eeeee-fffff-g"; 
  // ^ placeholder, not valid. Replace with your real principal if you have it.

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useUserQueueFeed(userPrincipalString);

  // Flatten out all pages
  const allVideos = data?.pages.flatMap((page) => page.videos) || [];

  return (
    <AuthGuard>
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Your Personal Queue</h1>

        {status === 'loading' && <p>Loading feed...</p>}
        {status === 'error' && (
          <p className="text-red-600">
            Error: {String(error)}
          </p>
        )}

        <div className="space-y-4">
          {allVideos.map((video) => (
            <div key={video.id.toString()} className="border p-4 rounded">
              <h3 className="text-lg font-semibold">{video.title}</h3>
              <p className="text-gray-600">Video ID: {video.id.toString()}</p>
            </div>
          ))}
        </div>

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            {isFetchingNextPage ? 'Loading more...' : 'Load More'}
          </button>
        )}
      </div>
    </AuthGuard>
  );
}

// Export client-side only
export default dynamic(() => Promise.resolve(UserQueuePage), { ssr: false });

Important:
	•	Replace the userPrincipalString with the actual principal you want to test.
	•	In a real app, you might store the user’s IC principal in a context or retrieve it from the backend (since you’re bridging SIWE + principal).
	•	The AuthGuard ensures the user is logged in.

Summary
	•	Backend (main.mo): We added a userQueues map to store a user’s personal queue of video IDs, plus methods to enqueue new IDs and retrieve them in paginated “pages.”
	•	Frontend: We introduced useUserQueueFeed.ts to handle infinite pagination. Then in queue.tsx, we show how to integrate that with React Query’s useInfiniteQuery.

This design lets you build a TikTok-like feed for each user by pushing new recommended videos into their queue and letting them page through them on the client. Enjoy!