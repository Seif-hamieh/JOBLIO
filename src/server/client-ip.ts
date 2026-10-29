// The visitor's network address. The site is only reachable through Cloudflare, which sets CF-Connecting-IP to the
// real client address and overwrites any value a visitor sends. X-Forwarded-For is not used: its first entry is
// whatever the visitor wrote. Requests that didn't come through Cloudflare (local tests) get a fixed "local".
export function clientIp(headers: Headers) {
  return headers.get("cf-connecting-ip")?.trim() || "local";
}
