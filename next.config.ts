import type { NextConfig } from "next";

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
