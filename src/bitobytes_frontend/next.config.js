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
