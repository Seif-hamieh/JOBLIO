import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { k } from "@/i18n/message";

// Storage abstraction. The local driver writes under ./storage and is meant
// for development; implement the same three functions against S3 / R2 /
// GCS for production (see docs/ARCHITECTURE.md).

const ROOT = join(process.cwd(), "storage");
const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024);

export type UploadScope = "avatar" | "cover" | "company" | "post" | "project" | "resume" | "message";

const IMAGE = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const DOCS = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"] as const;

const ALLOWED: Record<UploadScope, readonly string[]> = {
  avatar: IMAGE,
  cover: IMAGE,
  company: IMAGE,
  post: IMAGE,
  project: IMAGE,
  resume: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  message: [...IMAGE, ...DOCS],
};

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
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
  const name = `${randomBytes(12).toString("hex")}.${EXT[mime]}`;
  const key = isPrivate ? `private/${scope}/${safeOwner}/${name}` : `public/${scope}/${name}`;
  const path = join(ROOT, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  const displayName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || name;
  return { key, url: `/api/v1/files/${key}`, name: displayName, size: file.size, mime };
}

/** Reads a stored file; returns null for anything outside the storage root. */
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
