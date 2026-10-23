// User-agent checks used to save serverless CPU (the Hobby plan has a monthly limit).

/**
 * Crawlers that bring no visitors: AI training scrapers and SEO-tool bots. They are turned away in
 * src/proxy.ts (and asked to stay out in robots.ts) before any page renders. Search engines (Google,
 * Bing, DuckDuckGo, Yandex…) and AI *search* bots that link back to the site are not on this list.
 */
export const BLOCKED_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "FacebookBot",
  "Google-Extended",
  "Applebot-Extended",
  "cohere-ai",
  "Diffbot",
  "Omgilibot",
  "ImagesiftBot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
  "DataForSeoBot",
  "BLEXBot",
  "Barkrowler",
  "serpstatbot",
  "SeekportBot",
] as const;

const BLOCKED = new RegExp(BLOCKED_BOTS.map((b) => b.replace(/[-.]/g, "\\$&")).join("|"), "i");

/** Any automated client (search engines included): used to skip work that only matters for people. */
const ANY_BOT = /bot|crawl|spider|slurp|scrape|preview|fetch|monitor|headless|lighthouse|python-requests|curl|wget|httpclient/i;

export function isBlockedBot(userAgent: string | null | undefined) {
  return !!userAgent && BLOCKED.test(userAgent);
}

export function isBot(userAgent: string | null | undefined) {
  return !userAgent || ANY_BOT.test(userAgent);
}
