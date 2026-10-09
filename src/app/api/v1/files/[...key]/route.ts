import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { publicFileUrl, readStored, signedFileUrl, storageDriver } from "@/server/storage";

// GET /api/v1/files/<key> — serves uploads. Public files are cacheable;
// private files (CVs, message attachments) are checked against the viewer.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/files/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!/^(public|private)\/[a-z]+\/[\w./-]+$/.test(key) || key.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (key.startsWith("private/")) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) return new NextResponse("Not found", { status: 404 });
    const [, scope, owner] = key.split("/");
    const userId = session.user.id;
    const url = `/api/v1/files/${key}`;
    let allowed = false;
    if (scope === "resume") {
      // The candidate, or a member of a company the candidate applied to with this file.
      allowed =
        owner === userId ||
        !!(await db.application.findFirst({
          where: { resumeUrl: url, job: { company: { members: { some: { userId } } } } },
          select: { id: true },
        }));
    } else if (scope === "message") {
      allowed = !!(await db.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: owner!, userId } },
        select: { userId: true },
      }));
    }
    if (!allowed) return new NextResponse("Not found", { status: 404 });
  }

  // Supabase: hand the browser straight to storage — no file bytes pass through
  // the serverless function. Private files get a signed URL valid for 5 minutes.
  if (storageDriver() === "supabase") {
    if (key.startsWith("public/")) {
      return NextResponse.redirect(publicFileUrl(key), { status: 308, headers: { "Cache-Control": "public, max-age=31536000, immutable" } });
    }
    const signed = await signedFileUrl(key);
    if (!signed) return new NextResponse("Not found", { status: 404 });
    return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  }

  const file = await readStored(key);
  if (!file) return new NextResponse("Not found", { status: 404 });
  const isImage = file.mime.startsWith("image/");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": isImage || file.mime === "application/pdf" ? "inline" : "attachment",
      "Cache-Control": key.startsWith("public/") ? "public, max-age=31536000, immutable" : "private, max-age=300",
    },
  });
}
