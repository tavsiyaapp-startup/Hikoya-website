import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted: a user with a page open from just before a deploy would
  // otherwise silently fail on stale asset/Server Action requests. Tagging
  // each build with the commit SHA lets Next.js detect that mismatch and
  // force a full page reload instead. GITHUB_SHA is set automatically by
  // Actions; falls back to a build timestamp for local/manual builds.
  deploymentId: process.env.GITHUB_SHA || `local-${Date.now()}`,
  // Moving off Vercel to a self-hosted server (hikoya.org) — send anyone who
  // still lands on the old *.vercel.app URL to the real domain instead.
  // Scoped via `has: host`, so this is a no-op everywhere except that host.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "hikoyaa.vercel.app" }],
        destination: "https://hikoya.org/:path*",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Self-hosted (see server.js): no built-in image CDN like Vercel's, and
    // this host's 500MB RAM makes on-the-fly `sharp` transforms risky.
    // Serve originals untouched instead of optimizing.
    unoptimized: true,
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
