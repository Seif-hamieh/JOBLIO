// Sentry is switched off to save serverless CPU (the Hobby plan has a monthly limit): no SDK is loaded
// on the server, and Next.js is no longer wrapped by withSentryConfig (see next.config.ts).
// Errors still reach the Vercel logs through console.error. To turn Sentry back on, restore this file,
// src/instrumentation-client.ts and the wrapper from git history (sentry.*.config.ts are kept).
export async function register() {}
