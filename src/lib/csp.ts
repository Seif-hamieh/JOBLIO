// Content-Security-Policy with a per-request nonce (set by src/proxy.ts).
// Scripts: only ones carrying the nonce (Next adds it to its own tags) and what
// they load ('strict-dynamic') — no 'unsafe-inline'. Styles keep 'unsafe-inline'
// because style attributes (Tailwind arbitrary values, animations) can't carry a nonce.

export function buildCsp(nonce: string, isDev = process.env.NODE_ENV !== "production") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "media-src 'self' blob: https:",
    "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
