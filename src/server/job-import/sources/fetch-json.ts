import "server-only";

/** GET a public JSON API with a timeout and an honest User-Agent; throws with the status on failure. */
export async function fetchJson(url: string, timeoutMs = 20_000): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "JOBLIO job import (+https://getjoblio.app)" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return res.json();
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
