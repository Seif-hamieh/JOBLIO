import { z } from "zod";
import { resolvePostReportsAsAdmin } from "@/server/services/admin";
import { mobileError } from "@/server/mobile/auth";
import { adminChange } from "@/server/mobile/admin";

export const dynamic = "force-dynamic";

const body = z.object({ deletePost: z.boolean() });

// POST /api/mobile/admin/post-reports/:postId  { deletePost }  →  { message }
// Settles every open report on the post: deletes the post (with its comments, likes and photos), or just
// dismisses the reports.
export async function POST(req: Request, { params }: RouteContext<"/api/mobile/admin/post-reports/[postId]">) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return mobileError(400, "INVALID_BODY", "Say whether to delete the post.");
  const { postId } = await params;
  return adminChange(req, () => resolvePostReportsAsAdmin(postId.slice(0, 64), parsed.data.deletePost));
}
