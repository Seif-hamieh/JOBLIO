import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { LIMITS, rateLimit } from "@/server/rate-limit";
import { withCurrentCompanyNames } from "@/server/services/notifications";
import { getMobileSession, mobileError } from "@/server/mobile/auth";
import { toNotification } from "@/server/mobile/network";

export const dynamic = "force-dynamic";

const PAGE = 30;

// GET /api/mobile/notifications?before=<id>  →  { notifications, unread, nextCursor }
// Newest first, 30 at a time (the website's notifications page). Opening the list doesn't mark anything read.
export async function GET(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  const before = new URL(req.url).searchParams.get("before")?.slice(0, 40) || undefined;
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(before && { cursor: { id: before }, skip: 1 }),
      select: { id: true, type: true, title: true, body: true, titleKey: true, bodyKey: true, vars: true, href: true, readAt: true, createdAt: true, actorId: true, actor: { select: { name: true, image: true } } },
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  const page = rows.slice(0, PAGE);
  return NextResponse.json(
    { notifications: (await withCurrentCompanyNames(page)).map(toNotification), unread, nextCursor: rows.length > PAGE ? page[page.length - 1]!.id : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

const body = z.object({ id: z.string().min(1).max(40).optional() });

// POST /api/mobile/notifications  { id? }  →  { unread }
// Marks one notification read (when the member opens it), or all of them without an id.
export async function POST(req: Request) {
  const session = await getMobileSession(req);
  if (!session) return mobileError(401, "UNAUTHORIZED", "Sign in first.");
  const userId = session.user.id;
  if (!rateLimit(`${LIMITS.write.key}:${userId}`, LIMITS.write.max, LIMITS.write.windowMs).ok) return mobileError(429, "RATE_LIMITED", "Slow down a little.");
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Unknown notification.");
  await db.notification.updateMany({ where: { userId, readAt: null, ...(parsed.data.id && { id: parsed.data.id }) }, data: { readAt: new Date() } });
  const unread = await db.notification.count({ where: { userId, readAt: null } });
  return NextResponse.json({ unread }, { headers: { "Cache-Control": "no-store" } });
}
