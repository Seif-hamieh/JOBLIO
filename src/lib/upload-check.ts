import type { T } from "@/i18n/translate";

// Checks a file in the browser before it is sent. Vercel rejects request bodies
// over 4.5 MB before our code runs, which surfaces as a crash instead of a
// message — so oversize and wrong-type files must never leave the browser.
// The server re-checks everything (src/server/storage.ts); this is for UX.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / 1024 / 1024;

const IMAGE = { mimes: ["image/png", "image/jpeg", "image/webp", "image/gif"], exts: ["png", "jpg", "jpeg", "webp", "gif"] };
const CV = {
  mimes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"],
  exts: ["pdf", "docx", "doc"],
};
const ATTACHMENT = { mimes: [...IMAGE.mimes, ...CV.mimes, "text/plain"], exts: [...IMAGE.exts, ...CV.exts, "txt"] };

export const UPLOAD_KINDS = { image: IMAGE, cv: CV, attachment: ATTACHMENT } as const;
export type UploadKind = keyof typeof UPLOAD_KINDS;

/** Value for an `<input type="file" accept>` attribute. */
export const acceptFor = (kind: UploadKind) => [...UPLOAD_KINDS[kind].exts.map((e) => `.${e}`), ...UPLOAD_KINDS[kind].mimes].join(",");

const mb = (bytes: number) => (Math.ceil((bytes / 1024 / 1024) * 10) / 10).toFixed(1);

/**
 * Returns a translated error for the first problem found, or null when the
 * file(s) can be sent. Several files sent in one request share the size limit.
 */
export function checkUpload(input: File | File[], kind: UploadKind, t: T): string | null {
  const files = Array.isArray(input) ? input : [input];
  const allowed = UPLOAD_KINDS[kind];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    // Some browsers report an empty type (e.g. .doc on Windows); fall back to the extension.
    const typeOk = file.type ? (allowed.mimes as readonly string[]).includes(file.type) : (allowed.exts as readonly string[]).includes(ext);
    if (!typeOk || !(allowed.exts as readonly string[]).includes(ext)) return t(`msg.uploadType_${kind}`);
    if (file.size === 0) return t("msg.uploadChoose");
  }
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) return t("msg.uploadTooBigSize", { max: MAX_UPLOAD_MB, size: mb(total) });
  return null;
}
