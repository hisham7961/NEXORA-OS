import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Business logic lives in the domain/service layer and is exercised by both the
  // web app (server components / route handlers) and the versioned REST API, so the
  // same permission and audit rules apply everywhere (API-first, §33).
  serverExternalPackages: ["@prisma/client", "@prisma/engines"],
  experimental: {
    // Keep server actions available for progressive-enhancement forms.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
