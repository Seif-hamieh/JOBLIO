import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const isDev = process.env.NODE_ENV !== "production";

// The Content-Security-Policy is set per request in src/proxy.ts (it carries a
// fresh nonce, so it can't be a static header). These apply to every response.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Resolve page metadata before streaming for every request (not only for a few bots), so
  // a missing job/company/profile answers with a real 404 status and the title/og tags are in <head>.
  htmlLimitedBots: /.*/,
  // The generated Prisma client and pg are server-only; keep them out of the bundler.
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "nodemailer"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Uploads go through server actions; allow files up to the configured limit.
    serverActions: { bodySizeLimit: "12mb" },
  },
  async redirects() {
    // /professionals has no list of its own yet: send people to Featured Professionals.
    return [{ source: "/professionals", destination: "/professionals/featured", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The service worker must always be re-checked so updates ship on the next visit.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Source maps upload only when SENTRY_AUTH_TOKEN is set (e.g. on Vercel); keep it out of git.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Upload a larger set of source maps for readable stack traces.
  widenClientFileUpload: true,
  // Browser events go through our own domain: no CSP change (connect-src stays 'self'),
  // and ad blockers don't drop them. Excluded from the matcher in src/proxy.ts.
  tunnelRoute: "/monitoring",
  // Only print logs for uploading source maps in CI.
  silent: !process.env.CI,
});
