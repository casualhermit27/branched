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
  // Use specific extensions to ignore legacy Pages Router files (src/pages/api/*.ts)
  // while keeping App Router files (page.tsx, route.ts, etc.) working.
  pageExtensions: [
    'page.tsx', 'page.ts', 'page.jsx', 'page.js',
    'route.tsx', 'route.ts', 'route.jsx', 'route.js',
    'layout.tsx', 'layout.ts', 'layout.jsx', 'layout.js',
    'loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js',
    'error.tsx', 'error.ts', 'error.jsx', 'error.js',
    'not-found.tsx', 'not-found.ts', 'not-found.jsx', 'not-found.js',
    'template.tsx', 'template.ts', 'template.jsx', 'template.js',
    'default.tsx', 'default.ts', 'default.jsx', 'default.js',
  ],
};

export default nextConfig;
