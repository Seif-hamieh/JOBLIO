import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getCounts } from "@/server/services/counts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getCounts(session.user.id), { headers: { "Cache-Control": "no-store" } });
}
