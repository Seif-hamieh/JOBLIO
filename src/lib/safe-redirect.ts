/** Only allow same-origin relative paths as post-login destinations. */
export function safeNext(next: string | string[] | undefined | null, fallback = "/feed") {
  const v = Array.isArray(next) ? next[0] : next;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.startsWith("/api/")) return fallback;
  return v;
}
