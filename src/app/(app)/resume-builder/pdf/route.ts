import { getLocale } from "@/i18n/server";
import { getViewer } from "@/server/session";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getResume, resumeFileName, resumePdf } from "@/server/services/resume-builder";

export const dynamic = "force-dynamic";

// GET /resume-builder/pdf  →  the signed-in member's CV as a PDF (downloaded), in the website's language.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Sign in first.", { status: 401 });
  if (!rateLimit(`${LIMITS.pdf.key}:${viewer.id}`, LIMITS.pdf.max, LIMITS.pdf.windowMs).ok) return new Response("Too many downloads. Try again in a few minutes.", { status: 429 });
  const locale = await getLocale();
  const { data } = await getResume(viewer.id, locale);
  const pdf = await resumePdf(data, locale);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CV.pdf"; filename*=UTF-8''${encodeURIComponent(resumeFileName(data))}`,
      "Cache-Control": "private, no-store",
    },
  });
}
