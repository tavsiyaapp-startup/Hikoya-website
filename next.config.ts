import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // isomorphic-dompurify pulls in jsdom, which does dynamic requires Next's
  // serverless file tracing doesn't always catch — works with a full local
  // node_modules (next dev, next start) but 500s on Vercel's pruned bundle
  // where those files never got copied in. Keeping it external makes Vercel
  // ship the whole package instead of trying to trace/bundle it.
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],
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
