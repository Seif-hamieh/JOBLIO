import "server-only";
import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/server/db";
import { deleteStored, storageDriver } from "@/server/storage";

// Nightly disk cleanup (run by /api/cron/sync-jobs at 2:00): stories past their 24 hours are deleted with their
// files, then files nothing points to any more are removed — videos and still frames uploaded for a post or story
// that was never shared, chat files whose message was never sent, and half-finished uploads (.part).
// Only folders whose every use is known are swept: public/media, public/story and private/message.

const FILES_PREFIX = "/api/v1/files/";
/** A file must be at least this old before it counts as left over: it may belong to a post being written right now. */
const GRACE_MS = 24 * 60 * 60_000;

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)])));
  return nested.flat();
}

/** Every stored file url still in use by a post, draft, story or chat message in the swept folders. */
async function usedUrls() {
  const [posts, drafts, stories, messages] = await Promise.all([
    db.post.findMany({ where: { OR: [{ mediaType: "VIDEO" }, { thumbnailUrl: { not: null } }] }, select: { mediaUrls: true, thumbnailUrl: true } }),
    db.postDraft.findMany({ select: { mediaUrls: true } }),
    db.story.findMany({ select: { mediaUrl: true, thumbnailUrl: true } }),
    db.message.findMany({ where: { attachmentUrl: { not: null } }, select: { attachmentUrl: true } }),
  ]);
  return new Set(
    [
      ...posts.flatMap((p) => [...p.mediaUrls, p.thumbnailUrl]),
      ...drafts.flatMap((d) => d.mediaUrls),
      ...stories.flatMap((s) => [s.mediaUrl, s.thumbnailUrl]),
      ...messages.map((m) => m.attachmentUrl),
    ].filter((u): u is string => !!u),
  );
}

/** Deletes expired stories and left-over files. `graceMs` 0 also removes files uploaded moments ago (manual runs). */
export async function cleanupStorage(graceMs = GRACE_MS) {
  const expired = await db.story.findMany({ where: { expiresAt: { lt: new Date() } }, select: { id: true, mediaUrl: true, thumbnailUrl: true } });
  if (expired.length) {
    await db.story.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } });
    await deleteStored(expired.flatMap((s) => [s.mediaUrl, s.thumbnailUrl]));
  }
  if (storageDriver() !== "local") return { expiredStories: expired.length, orphans: 0, bytes: 0 };

  const root = join(process.cwd(), "storage");
  const used = await usedUrls();
  const cutoff = Date.now() - graceMs;
  let orphans = 0;
  let bytes = 0;
  for (const folder of ["public/media", "public/story", "private/message"]) {
    for (const path of await filesUnder(join(root, folder))) {
      const s = await stat(path).catch(() => null);
      if (!s || s.mtimeMs > cutoff) continue;
      const url = FILES_PREFIX + path.slice(root.length + 1).split("\\").join("/");
      if (!path.endsWith(".part") && used.has(url)) continue;
      if (await unlink(path).then(() => true, () => false)) {
        orphans++;
        bytes += s.size;
      }
    }
  }
  return { expiredStories: expired.length, orphans, bytes };
}
