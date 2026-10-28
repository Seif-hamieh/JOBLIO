import "server-only";
import { z } from "zod";
import { deleteStored, storeUpload, UploadError } from "@/server/storage";
import { MAX_DRAFT_MEDIA, type DraftFields, type listDrafts } from "@/server/services/post-drafts";
import { mobileError } from "@/server/mobile/auth";
import { createT } from "@/i18n/translate";
import { resolveMessage } from "@/i18n/message";

// The app's side of post drafts. The app writes personal updates (text, who sees it, one image); a draft started on
// the website keeps whatever else it has (post type, attached job or project, posting as the company) when edited here.

type Draft = Awaited<ReturnType<typeof listDrafts>>[number];

export const toDraft = (d: Draft) => ({
  id: d.id,
  content: d.content,
  visibility: d.visibility,
  mediaUrls: d.mediaUrls,
  updatedAt: d.updatedAt.toISOString(),
});

const fields = z.object({
  content: z.string().trim().max(3000).catch(""),
  visibility: z.enum(["PUBLIC", "CONNECTIONS"]).catch("PUBLIC"),
});

/** Plain-English text for a message key, for the app's error responses. */
export const messageText = (key: string) => resolveMessage(createT("en"), key);

/**
 * Reads a multipart draft request: content, visibility, image? (a new image) and keepMedia (the draft's images to
 * keep; repeated). `existing` is the draft being edited, whose other fields carry over. Returns the fields with the
 * kept and added images, or an error response.
 */
export async function readDraftForm(req: Request, userId: string, existing: Draft | null) {
  const form = await req.formData().catch(() => null);
  if (!form) return { error: mobileError(400, "INVALID_BODY", "Send the draft as multipart form data.") };
  const f = fields.parse({ content: form.get("content") ?? "", visibility: form.get("visibility") ?? "PUBLIC" });
  const d: DraftFields = {
    content: f.content,
    visibility: f.visibility,
    type: existing?.type ?? "UPDATE",
    asCompany: existing?.asCompany ? "1" : "0",
    jobId: existing?.jobId ?? null,
    projectId: existing?.projectId ?? null,
  };
  const kept = form.getAll("keepMedia").filter((v): v is string => typeof v === "string");
  const added: string[] = [];
  const image = form.get("image");
  if (image instanceof File && image.size > 0 && kept.length < MAX_DRAFT_MEDIA) {
    try {
      added.push((await storeUpload(image, "post", userId)).url);
    } catch (e) {
      if (e instanceof UploadError) return { error: mobileError(400, "INVALID_IMAGE", messageText(e.message)) };
      throw e;
    }
  }
  return { d, kept, added, discard: () => deleteStored(added) };
}
