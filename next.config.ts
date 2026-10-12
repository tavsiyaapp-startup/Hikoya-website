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
  // Baseline browser hardening for every page. No full Content-Security-
  // Policy on pages (Google Analytics + Next's inline bootstrap scripts would
  // need a nonce setup to avoid breaking the site) — but user uploads get a
  // strict one: they're served from this same origin, so even a file that
  // somehow slipped past the byte-level type check in
  // src/server/storage/local.ts can't run script or be sniffed as HTML.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/uploads/:path*",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; sandbox" }],
      },
    ];
  },
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
        hostname: "krmyymorexsfwpvkfqzq.supabase.co",
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
