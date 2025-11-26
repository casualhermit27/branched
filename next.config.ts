import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    root: __dirname,
  },
  // Remove console.log statements in production builds (keeps console.error and console.warn)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? {
          exclude: ['error', 'warn'], // Keep console.error and console.warn for debugging
        }
      : false,
  },
};

export default nextConfig;
