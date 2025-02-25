/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // For local development, use local dist
  distDir: 'dist',
  // Always use export output
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Used for static HTML exports for IC deployment
  trailingSlash: true,
}

module.exports = nextConfig
