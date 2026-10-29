import "server-only";

// Fixed-window counter kept in process memory. Good for a single instance;
// for horizontal scaling, back this with Redis (INCR + EXPIRE) behind the
// same function signature.

type Bucket = { count: number; resetAt: number };

const store = ((globalThis as { __joblioRateLimit?: Map<string, Bucket> }).__joblioRateLimit ??= new Map());

let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
}

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  sweep(now);
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: max - 1, retryAfterSeconds: 0 };
  }
  if (bucket.count >= max) {
    return { ok: false as const, remaining: 0, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true as const, remaining: max - bucket.count, retryAfterSeconds: 0 };
}

export const LIMITS = {
  post: { key: "post", max: 30, windowMs: 60 * 60_000 },
  story: { key: "story", max: 20, windowMs: 24 * 60 * 60_000 },
  comment: { key: "comment", max: 30, windowMs: 10 * 60_000 },
  like: { key: "like", max: 120, windowMs: 60_000 },
  message: { key: "message", max: 40, windowMs: 60_000 },
  connect: { key: "connect", max: 30, windowMs: 60 * 60_000 },
  apply: { key: "apply", max: 30, windowMs: 60 * 60_000 },
  upload: { key: "upload", max: 30, windowMs: 10 * 60_000 },
  write: { key: "write", max: 60, windowMs: 60_000 },
  search: { key: "search", max: 120, windowMs: 60_000 },
  checkout: { key: "checkout", max: 10, windowMs: 10 * 60_000 },
  sensitive: { key: "sensitive", max: 5, windowMs: 15 * 60_000 },
} as const;
