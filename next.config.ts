import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use the correct serverExternalPackages instead of experimental
  serverExternalPackages: ['sharp'],
  
  // Include sharp in output file tracing for Vercel
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/sharp/**/*'],
  },
  
  // Remove webpack externalization that was causing issues
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't externalize sharp - let it bundle properly
      config.externals = config.externals?.filter((external: any) => {
        if (typeof external === 'string') return external !== 'sharp';
        if (typeof external === 'object' && external.sharp) return false;
        return true;
      }) || [];
    }
    return config;
  },
};

export default nextConfig;
