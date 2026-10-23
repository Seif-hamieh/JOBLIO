import { describe, expect, it } from "vitest";
import { isBlockedBot, isBot } from "./bots";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

describe("isBlockedBot", () => {
  it("blocks AI-training and SEO scrapers", () => {
    expect(isBlockedBot("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)")).toBe(true);
    expect(isBlockedBot("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)")).toBe(true);
    expect(isBlockedBot("meta-externalagent/1.1")).toBe(true);
  });

  it("lets people, search engines and link previews through", () => {
    expect(isBlockedBot(CHROME)).toBe(false);
    expect(isBlockedBot(GOOGLEBOT)).toBe(false);
    expect(isBlockedBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(false);
    expect(isBlockedBot("facebookexternalhit/1.1")).toBe(false);
    expect(isBlockedBot("WhatsApp/2.23.20.0")).toBe(false);
    expect(isBlockedBot(null)).toBe(false);
  });
});

describe("isBot", () => {
  it("spots crawlers, including search engines", () => {
    expect(isBot(GOOGLEBOT)).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot(null)).toBe(true);
  });

  it("treats browsers as people", () => {
    expect(isBot(CHROME)).toBe(false);
  });
});
