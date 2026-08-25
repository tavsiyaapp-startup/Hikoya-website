import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Default is 1MB. .docx manuscripts (especially with embedded images)
      // need real headroom — see src/lib/actions/import-docx.ts.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
