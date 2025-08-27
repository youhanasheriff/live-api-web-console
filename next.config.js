/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Support for existing React app structure
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  
  // Custom webpack config to handle existing src structure
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Handle audio worklets and other assets
    config.module.rules.push({
      test: /\.(ts|js)$/,
      include: /worklets/,
      use: {
        loader: 'raw-loader',
      },
    });
    
    return config;
  },
  
  // Environment variables
  env: {
    REACT_APP_OPENAI_API_KEY: process.env.REACT_APP_OPENAI_API_KEY,
    REACT_APP_GEMINI_API_KEY: process.env.REACT_APP_GEMINI_API_KEY,
  },
  
  // API routes configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;