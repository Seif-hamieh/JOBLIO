import "server-only";
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "@/server/db";
import { APP_URL } from "@/lib/utils";

// Google Indexing API: tells Google at once when a job page appears or goes away, instead of waiting for the next
// crawl (Google allows this API for pages with JobPosting data). Off unless GOOGLE_INDEXING_KEY_FILE points to the
// JSON key of a Google Cloud service account that is an Owner of the site in Search Console. Best effort: a failure
// is logged and never affects the action that triggered it.

const SCOPE = "https://www.googleapis.com/auth/indexing";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PUBLISH_URL = "https://indexing.googleapis.com/v3/urlNotifications:publish";

type Key = { client_email: string; private_key: string };
let key: Promise<Key | null> | null = null;
let token: { value: string; expires: number } | null = null;

function loadKey() {
  const file = process.env.GOOGLE_INDEXING_KEY_FILE?.trim();
  if (!file) return Promise.resolve(null);
  key ??= readFile(file, "utf8")
    .then((s) => JSON.parse(s) as Key)
    .catch((e) => {
      console.error("[indexing] cannot read GOOGLE_INDEXING_KEY_FILE:", e instanceof Error ? e.message : e);
      key = null;
      return null;
    });
  return key;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** An access token for the service account (a signed JWT exchanged at Google), reused until shortly before expiry. */
async function accessToken(k: Key) {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iss: k.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(k.private_key);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(`token: ${res.status} ${data.error_description ?? ""}`);
  token = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function publish(url: string, type: "URL_UPDATED" | "URL_DELETED") {
  const k = await loadKey();
  if (!k) return;
  try {
    const res = await fetch(PUBLISH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken(k)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, type }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error(`[indexing] ${type} ${url} → ${res.status} ${(await res.text()).slice(0, 200)}`);
    else console.log(`[indexing] ${type} ${url}`);
  } catch (e) {
    console.error(`[indexing] ${type} ${url} failed:`, e instanceof Error ? e.message : e);
  }
}

/**
 * Call after a job is created, edited, opened, paused, closed or deleted: Google is told the page was updated
 * while the job is open on JOBLIO (imported listings never: their sources don't allow passing them to Google
 * Jobs), and that it is gone otherwise. Doesn't wait for Google.
 */
export function notifyGoogleAboutJob(jobId: string) {
  void (async () => {
    if (!(await loadKey())) return;
    const job = await db.job.findUnique({ where: { id: jobId }, select: { status: true, publishedAt: true, externalSource: true } });
    if (job?.externalSource) return;
    await publish(`${APP_URL}/jobs/${jobId}`, job && job.status === "OPEN" && job.publishedAt ? "URL_UPDATED" : "URL_DELETED");
  })().catch((e) => console.error("[indexing]", e));
}
