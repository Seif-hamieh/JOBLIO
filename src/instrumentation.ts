// Sentry is switched off to save serverless CPU (the Hobby plan has a monthly limit): no SDK is loaded
// on the server, and Next.js is no longer wrapped by withSentryConfig (see next.config.ts).
// Errors still reach the Vercel logs through console.error. To turn Sentry back on, restore this file,
// src/instrumentation-client.ts and the wrapper from git history (sentry.*.config.ts are kept).
export async function register() {}

/**
 * Every error while rendering a page or answering a route, with the path and who asked (so a failure that only a
 * crawler sees, such as Googlebot, shows up in `pm2 logs joblio --err` with its cause).
 */
export function onRequestError(error: unknown, request: { path: string; method: string; headers: Record<string, string | string[] | undefined> }) {
  const ua = String(request.headers["user-agent"] ?? "").slice(0, 160);
  console.error(`[request-error] ${request.method} ${request.path} ua="${ua}"`, error);
}
