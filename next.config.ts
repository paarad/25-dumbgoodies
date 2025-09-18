import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure webpack for sharp production compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Handle sharp module for server-side rendering
      config.externals = config.externals || [];
      config.externals.push({
        sharp: 'commonjs sharp'
      });
    }
    return config;
  },
  // Ensure serverless compatibility
  serverExternalPackages: ['sharp'],
};

export default nextConfig;
