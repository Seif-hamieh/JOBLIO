import "server-only";
import { db } from "@/server/db";
import { deleteStored, storeUpload } from "@/server/storage";

// The CV saved on a member's profile — one per profile, attached (as a copy) when they apply with "use my CV".
// Shared by the website's profile editor and the app's "My CV" screen. Files are private (private/resume/<userId>/…).

const select = { resumeUrl: true, resumeName: true, resumeUpdatedAt: true } as const;

export async function getResume(userId: string) {
  const p = await db.profile.findUnique({ where: { userId }, select });
  return p?.resumeUrl ? { url: p.resumeUrl, name: p.resumeName ?? "CV", updatedAt: p.resumeUpdatedAt } : null;
}

/**
 * Saves a PDF or Word file as the member's CV, replacing (and deleting) the previous one. `displayName` is the
 * file's original name when the uploader knows it better than the upload does (the app). Throws UploadError for a
 * file that isn't a real PDF / Word document or is too big.
 */
export async function saveResume(userId: string, file: File, displayName?: string | null) {
  const old = (await db.profile.findUnique({ where: { userId }, select: { resumeUrl: true } }))?.resumeUrl;
  const stored = await storeUpload(file, "resume", userId);
  const name = displayName?.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || stored.name;
  const updatedAt = new Date();
  await db.profile.update({ where: { userId }, data: { resumeUrl: stored.url, resumeName: name, resumeUpdatedAt: updatedAt } });
  await deleteStored([old]);
  return { url: stored.url, name, updatedAt };
}

/** Removes the member's CV and its file. Applications keep their own copies. */
export async function removeResume(userId: string) {
  const old = (await db.profile.findUnique({ where: { userId }, select: { resumeUrl: true } }))?.resumeUrl;
  await db.profile.update({ where: { userId }, data: { resumeUrl: null, resumeName: null, resumeUpdatedAt: null } });
  await deleteStored([old]);
}
