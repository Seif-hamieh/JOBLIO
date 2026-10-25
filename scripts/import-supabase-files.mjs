// One-off copy of every uploaded file from Supabase Storage to ./storage, for the self-hosted site
// (STORAGE_DRIVER=local). The database keeps the same /api/v1/files/<key> URLs, so nothing else changes:
// key "public/..." lives in the "uploads" bucket, "private/..." in "uploads-private", and both map to
// storage/<key> on disk. Files already on disk with the same size are skipped, so it is safe to run again.
//   node scripts/import-supabase-files.mjs
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.production.local (never printed).
import { readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(import.meta.dirname, "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env.production.local"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^(\w+)=(.*)$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.trim().replace(/^"|"$/g, "")]),
);
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.production.local");
  process.exit(1);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BUCKETS = ["uploads", "uploads-private"];

/** Every file path in a bucket (folders come back without an id and are listed recursively). */
async function listAll(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listAll(bucket, path)));
      else out.push({ path, size: item.metadata?.size });
    }
    if (data.length < 1000) return out;
  }
}

let copied = 0, skipped = 0, failed = 0;
for (const bucket of BUCKETS) {
  const files = await listAll(bucket);
  console.log(`${bucket}: ${files.length} files`);
  for (const { path, size } of files) {
    if (!/^(public|private)\//.test(path) || path.includes("..")) { skipped++; continue; }
    const target = join(root, "storage", path);
    const existing = await stat(target).catch(() => null);
    if (existing && (size === undefined || existing.size === size)) { skipped++; continue; }
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) { failed++; console.error(`  failed: ${path} (${error.message})`); continue; }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
    copied++;
  }
}
console.log(`copied ${copied}, already there ${skipped}, failed ${failed}`);
process.exit(failed ? 1 : 0);
