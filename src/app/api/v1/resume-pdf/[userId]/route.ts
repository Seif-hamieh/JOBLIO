import { LIMITS, rateLimit } from "@/server/rate-limit";
import { getResume, resumeFileName, resumePdf, verifyResumePdfLink } from "@/server/services/resume-builder";

export const dynamic = "force-dynamic";

// GET /api/v1/resume-pdf/:userId?lang&exp&sig  →  that member's CV PDF, through a 10-minute signed link the app
// opens in the phone's browser (which can't send the app's sign-in). Shown in the browser, which offers to save it.
export async function GET(req: Request, { params }: RouteContext<"/api/v1/resume-pdf/[userId]">) {
  const { userId } = await params;
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang") === "ar" ? "ar" : "en";
  if (!verifyResumePdfLink(userId, lang, url.searchParams.get("exp"), url.searchParams.get("sig"))) return new Response("This link has expired. Open it again from the app.", { status: 403 });
  if (!rateLimit(`${LIMITS.pdf.key}:${userId}`, LIMITS.pdf.max, LIMITS.pdf.windowMs).ok) return new Response("Too many downloads. Try again in a few minutes.", { status: 429 });
  const { data } = await getResume(userId, lang);
  const pdf = await resumePdf(data, lang);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="CV.pdf"; filename*=UTF-8''${encodeURIComponent(resumeFileName(data))}`,
      "Cache-Control": "private, no-store",
    },
  });
}
