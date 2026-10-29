import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/server/client-ip";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { ensureReferenceData } from "@/server/services/reference-data";
import { searchSkills } from "@/lib/skill-search";

// The whole taxonomy is a few hundred rows: cache it and match in memory
// (normalised names + aliases) instead of a database query per keystroke.
const allSkills = unstable_cache(
  async () => {
    const rows = await db.skill.findMany({ select: { id: true, name: true, slug: true, category: true, aliases: true, usageCount: true } });
    if (!rows.length) throw new Error("no skills yet"); // never cache an empty taxonomy
    return rows;
  },
  ["skills:all:v1"],
  { revalidate: 600, tags: ["reference-data"] },
);

// GET /api/v1/skills?q=rea — skill taxonomy autocomplete (public, cacheable).
export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);
  // 30 lookups per minute per address (the search box debounces typing).
  if (!rateLimit(`skills:${ip}`, 30, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const raw = req.nextUrl.searchParams.get("q") ?? "";
  if (raw.length > 100) return NextResponse.json({ error: "Query too long (max 100 characters)" }, { status: 400 });
  const q = raw.trim().slice(0, 50);
  await ensureReferenceData();
  const rows = await allSkills().catch(() => []);
  const skills = searchSkills(rows, q, q ? 10 : 16);
  // Don't let a CDN keep an empty answer around (e.g. while the database was being filled).
  const cache = rows.length ? "public, max-age=300, stale-while-revalidate=3600" : "no-store";
  return NextResponse.json({ skills }, { headers: { "Cache-Control": cache } });
}
