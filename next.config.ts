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
    // Default is 4h — every re-fetch past that TTL is a billed re-transformation
    // even though the image never changed (this is what was burning through the
    // Vercel free tier). Safe to push way out: every upload (covers/avatars/
    // hero-slides) is written to a `${Date.now()}-${filename}` path, so a new
    // upload is always a new URL — nothing ever changes under an existing URL,
    // so there's no staleness risk from caching a URL's transform for longer.
    minimumCacheTTL: 2678400, // 31 days
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
