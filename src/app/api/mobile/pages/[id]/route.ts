import { NextResponse } from "next/server";
import { STATIC_PAGES, type StaticPageId } from "@/content/static-pages";
import { cacheHeaders, mobileError } from "@/server/mobile/auth";

// GET /api/mobile/pages/:id?lang=en|ar  →  { page: { title, intro, updated, sections }, contactEmail? }
// The website's About / Terms / Privacy / Refunds / Contact text (content/static-pages), so the app shows exactly the
// same words. The same for everyone: cached by the CDN for a minute.
export async function GET(req: Request, { params }: RouteContext<"/api/mobile/pages/[id]">) {
  const { id } = await params;
  if (!(id in STATIC_PAGES)) return mobileError(404, "NOT_FOUND", "No such page.");
  const lang = new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en";
  const page = STATIC_PAGES[id as StaticPageId][lang];
  return NextResponse.json(
    {
      page: { title: page.title, intro: page.intro, updated: page.updated ?? null, sections: page.sections },
      // The public support address, as on the website's Contact page.
      ...(id === "contact" && { contactEmail: process.env.CONTACT_EMAIL || "support@getjoblio.app" }),
    },
    { headers: cacheHeaders(false) },
  );
}
