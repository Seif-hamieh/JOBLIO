import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { ensureReferenceData } from "@/server/services/reference-data";

// GET /api/v1/skills?q=rea — skill taxonomy autocomplete (public, cacheable).
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`skills:${ip}`, 120, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 50);
  await ensureReferenceData();
  const skills = await db.skill.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { aliases: { has: q.toLowerCase() } }] } : undefined,
    orderBy: [{ usageCount: "desc" }, { name: "asc" }],
    take: q ? 10 : 16,
    select: { id: true, name: true, slug: true, category: true },
  });
  // Exact and prefix matches first.
  const lower = q.toLowerCase();
  skills.sort((a, b) => {
    const rank = (n: string) => (n.toLowerCase() === lower ? 0 : n.toLowerCase().startsWith(lower) ? 1 : 2);
    return rank(a.name) - rank(b.name);
  });
  // Don't let a CDN keep an empty answer around (e.g. while the database was being filled).
  const cache = skills.length ? "public, max-age=300, stale-while-revalidate=3600" : "no-store";
  return NextResponse.json({ skills }, { headers: { "Cache-Control": cache } });
}
