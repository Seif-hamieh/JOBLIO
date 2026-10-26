import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { k } from "@/i18n/message";
import { APP_URL } from "@/lib/utils";

// Storage abstraction with two drivers, chosen by STORAGE_DRIVER:
//   local    — files under ./storage (development; not for serverless hosts)
//   supabase — Supabase Storage: a public bucket for images and a private
//              bucket for CVs and message attachments (short-lived signed URLs)
// Either way the app stores `/api/v1/files/<key>` URLs, so the access checks
// in that route keep working and existing data never needs rewriting.

const ROOT = join(process.cwd(), "storage");
const FILES_PREFIX = "/api/v1/files/";
// 4 MB by default: Vercel rejects request bodies over 4.5 MB (see src/lib/upload-check.ts).
const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 4 * 1024 * 1024);

export type UploadScope = "avatar" | "cover" | "company" | "post" | "project" | "resume" | "message" | "story";

const IMAGE = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const WORD = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"] as const;
const DOCS = [...WORD, "text/plain"] as const;

const ALLOWED: Record<UploadScope, readonly string[]> = {
  avatar: IMAGE,
  cover: IMAGE,
  company: IMAGE,
  post: IMAGE,
  project: IMAGE,
  story: IMAGE,
  resume: WORD,
  message: [...IMAGE, ...DOCS],
};

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
};

/** Identify the real file type from its first bytes — never trust the client's claim. */
export function sniffMime(buf: Buffer): string | null {
  const hex = buf.subarray(0, 12).toString("hex");
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("47494638")) return "image/gif";
  if (hex.startsWith("52494646") && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (hex.startsWith("25504446")) return "application/pdf";
  if (hex.startsWith("504b0304")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  // Legacy Word (.doc) uses the OLE compound-file header.
  if (hex.startsWith("d0cf11e0a1b11ae1")) return "application/msword";
  // Plain text: no NUL bytes in the first KB and valid UTF-8.
  const head = buf.subarray(0, 1024);
  if (!head.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(head);
      return "text/plain";
    } catch {}
  }
  return null;
}

export class UploadError extends Error {}

export type StoredFile = { key: string; url: string; name: string; size: number; mime: string };

export type StorageDriver = "local" | "supabase";

let warnedMissingSupabase = false;

export function storageDriver(): StorageDriver {
  const d = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (d === "local") return "local";
  if (d === "supabase" || (!d && process.env.SUPABASE_URL)) {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
    // Misconfigured: fall back to local storage instead of throwing on every upload and file read.
    // On Vercel, local uploads are still refused with a clear error (read-only filesystem).
    if (!warnedMissingSupabase) {
      warnedMissingSupabase = true;
      console.warn("[storage] STORAGE_DRIVER=supabase but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — using local storage instead.");
    }
  }
  return "local";
}

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(EXT).map(([mime, ext]) => [ext, mime]));
export const mimeFromKey = (key: string) => MIME_BY_EXT[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

// ── Supabase ────────────────────────────────────────────────────────────────

let supabase: SupabaseClient | null = null;
let bucketsReady: Promise<void> | null = null;

// Fixed bucket names (the SUPABASE_BUCKET / SUPABASE_PRIVATE_BUCKET variables are no longer read).
const PUBLIC_BUCKET = "uploads";
const PRIVATE_BUCKET = "uploads-private";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) console.warn("[storage] SUPABASE_SERVICE_ROLE_KEY is not set — Supabase uploads will fail. Add it in Vercel → Settings → Environment Variables.");
  if (!url || !serviceKey) throw new Error("STORAGE_DRIVER=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return { url, serviceKey, publicBucket: PUBLIC_BUCKET, privateBucket: PRIVATE_BUCKET };
}

/** Server-only client using the service role key (bypasses RLS; never sent to browsers). */
function client() {
  const { url, serviceKey } = supabaseConfig();
  supabase ??= createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabase;
}

const bucketFor = (key: string) => (key.startsWith("private/") ? supabaseConfig().privateBucket : supabaseConfig().publicBucket);

/** Creates the two buckets on first use if they don't exist yet (once per server instance). */
function ensureBuckets() {
  bucketsReady ??= (async () => {
    const { publicBucket, privateBucket } = supabaseConfig();
    for (const [name, isPublic] of [
      [publicBucket, true],
      [privateBucket, false],
    ] as const) {
      try {
        const { data } = await client().storage.getBucket(name);
        if (data) {
          if (data.public !== isPublic) console.warn(`[storage] Supabase bucket "${name}" should be ${isPublic ? "public" : "private"}.`);
          continue;
        }
        const { error } = await client().storage.createBucket(name, { public: isPublic, fileSizeLimit: MAX_BYTES });
        // Usually the bucket already exists (made in the dashboard). Never block the upload on this:
        // if the bucket is really missing, the upload itself fails with Supabase's own error.
        if (error && !/already exists|duplicate/i.test(error.message)) console.warn(`[storage] Could not create Supabase bucket "${name}": ${error.message}`);
      } catch (e) {
        console.warn(`[storage] Could not check Supabase bucket "${name}":`, e);
      }
    }
  })();
  return bucketsReady;
}

/** Supabase: the permanent public URL of a public file. */
export function publicFileUrl(key: string) {
  return client().storage.from(supabaseConfig().publicBucket).getPublicUrl(key).data.publicUrl;
}

/** Supabase: a short-lived signed URL for a private file (null if it doesn't exist). */
export async function signedFileUrl(key: string, expiresIn = 300) {
  const mime = mimeFromKey(key);
  const inline = mime.startsWith("image/") || mime === "application/pdf";
  const { data, error } = await client()
    .storage.from(supabaseConfig().privateBucket)
    .createSignedUrl(key, expiresIn, inline ? undefined : { download: true });
  return error || !data ? null : data.signedUrl;
}

// ── Signed links for the local driver ───────────────────────────────────────
// The app can't send the website's session cookie with a link it opens in the browser, so private files (CVs) are
// opened through a short-lived signed link instead, like Supabase's: /api/v1/files/<key>?exp=<unix>&sig=<hmac>.
// The signature covers the key and the expiry, so a link can't be changed, reused for another file or extended.

function linkSignature(key: string, exp: number) {
  return createHmac("sha256", `file-link:${process.env.BETTER_AUTH_SECRET ?? ""}`).update(`${key}\n${exp}`).digest("base64url");
}

/** True for an unexpired, untampered signed link to `key`. */
export function verifyFileLink(key: string, exp: string | null, sig: string | null) {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp) || Number(exp) * 1000 < Date.now()) return false;
  const expected = Buffer.from(linkSignature(key, Number(exp)));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * A link that opens a private file for `expiresIn` seconds without signing in: Supabase's signed URL, or our own
 * signed /api/v1/files link for local storage. Only hand it to someone already allowed to see the file.
 */
export async function privateFileLink(key: string, expiresIn = 300) {
  if (storageDriver() === "supabase") return signedFileUrl(key, expiresIn);
  if (!(await readStored(key))) return null;
  const exp = Math.floor(Date.now() / 1000) + expiresIn;
  return new URL(`${FILES_PREFIX}${key}?exp=${exp}&sig=${linkSignature(key, exp)}`, APP_URL).toString();
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Validates and stores an uploaded file. `owner` namespaces private files
 * (user id for resumes, conversation id for message attachments).
 */
export async function storeUpload(file: File, scope: UploadScope, owner: string): Promise<StoredFile> {
  if (!(file instanceof File) || file.size === 0) throw new UploadError("@msg.uploadChoose");
  if (file.size > MAX_BYTES) throw new UploadError(k("msg.uploadTooBig", { mb: Math.round(MAX_BYTES / 1024 / 1024) }));
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !ALLOWED[scope].includes(mime)) throw new UploadError("@msg.uploadType");

  const isPrivate = scope === "resume" || scope === "message";
  const safeOwner = owner.replace(/[^a-zA-Z0-9_-]/g, "");
  const name = `${randomUUID()}.${EXT[mime]}`;
  const key = isPrivate ? `private/${scope}/${safeOwner}/${name}` : `public/${scope}/${name}`;

  if (storageDriver() === "supabase") {
    await ensureBuckets();
    const { error } = await client()
      .storage.from(bucketFor(key))
      .upload(key, buf, { contentType: mime, cacheControl: isPrivate ? "300" : "31536000", upsert: false });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  } else {
    // Serverless hosts have a read-only, short-lived filesystem: fail loudly instead of losing files.
    if (process.env.VERCEL) throw new Error("STORAGE_DRIVER=local does not work on Vercel. Set STORAGE_DRIVER=supabase.");
    const path = join(ROOT, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buf);
  }

  const displayName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || name;
  return { key, url: `${FILES_PREFIX}${key}`, name: displayName, size: file.size, mime };
}

/** Local driver: reads a stored file; returns null for anything outside the storage root. */
export async function readStored(key: string) {
  const path = normalize(join(ROOT, key));
  if (!path.startsWith(ROOT + sep)) return null;
  try {
    const s = await stat(path);
    if (!s.isFile()) return null;
    const data = await readFile(path);
    return { data, mime: sniffMime(data) ?? "application/octet-stream", size: s.size };
  } catch {
    return null;
  }
}

/** Turns a stored `/api/v1/files/<key>` URL back into its key (null for seed media and external URLs). */
export function keyFromUrl(url: string | null | undefined) {
  if (!url?.startsWith(FILES_PREFIX)) return null;
  const key = url.slice(FILES_PREFIX.length);
  return /^(public|private)\/[a-z]+\/[\w./-]+$/.test(key) && !key.includes("..") ? key : null;
}

/**
 * Copies a stored private file to a new UUID name under the same scope and
 * owner, so the copy outlives the original (e.g. an application keeps its CV
 * after the profile CV is replaced). Returns the new URL, or null if the
 * source is missing.
 */
export async function copyStored(url: string): Promise<string | null> {
  const key = keyFromUrl(url);
  if (!key) return null;
  const ext = key.split(".").pop();
  const newKey = `${key.slice(0, key.lastIndexOf("/"))}/${randomUUID()}.${ext}`;
  if (storageDriver() === "supabase") {
    const { error } = await client().storage.from(bucketFor(key)).copy(key, newKey);
    if (error) {
      console.error("[storage] copy failed:", error.message);
      return null;
    }
  } else {
    const file = await readStored(key);
    if (!file) return null;
    const path = join(ROOT, newKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.data);
  }
  return `${FILES_PREFIX}${newKey}`;
}

/**
 * Deletes stored files by their URLs. Best effort: a storage hiccup is logged
 * and never fails the user's action (the database change already happened).
 */
export async function deleteStored(urls: (string | null | undefined)[]) {
  const keys = [...new Set(urls.map(keyFromUrl).filter((x): x is string => !!x))];
  if (!keys.length) return;
  try {
    if (storageDriver() === "supabase") {
      const groups = new Map<string, string[]>();
      for (const key of keys) groups.set(bucketFor(key), [...(groups.get(bucketFor(key)) ?? []), key]);
      for (const [bucket, list] of groups) {
        const { error } = await client().storage.from(bucket).remove(list);
        if (error) console.error(`[storage] delete failed in "${bucket}":`, error.message);
      }
    } else {
      await Promise.all(
        keys.map((key) => {
          const path = normalize(join(ROOT, key));
          return path.startsWith(ROOT + sep) ? unlink(path).catch(() => {}) : undefined;
        }),
      );
    }
  } catch (e) {
    console.error("[storage] delete failed:", e);
  }
}
