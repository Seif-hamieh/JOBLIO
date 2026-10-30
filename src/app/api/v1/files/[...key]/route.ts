import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { canViewProfile } from "@/server/services/profile";
import { openStored, publicFileUrl, signedFileUrl, storageDriver, verifyFileLink } from "@/server/storage";
import { getMobileSession } from "@/server/mobile/auth";

/**
 * The CV saved on a profile is visible to recruiters under the same rule as the
 * recruiter candidate page: the candidate applied to their company, or allows
 * recruiter search and their profile is visible to the recruiter.
 */
async function canSeeProfileCv(candidateId: string, url: string, viewerId: string) {
  const profile = await db.profile.findFirst({ where: { userId: candidateId, resumeUrl: url }, select: { searchableByRecruiters: true, visibility: true } });
  if (!profile) return false;
  const companyIds = (await db.companyMember.findMany({ where: { userId: viewerId }, select: { companyId: true } })).map((m) => m.companyId);
  if (!companyIds.length) return false;
  const applied = await db.application.findFirst({ where: { applicantId: candidateId, job: { companyId: { in: companyIds } } }, select: { id: true } });
  return !!applied || (profile.searchableByRecruiters && (await canViewProfile(candidateId, profile.visibility, viewerId)));
}

// GET /api/v1/files/<key> — serves uploads. Public files are cacheable;
// private files (CVs, message attachments) are checked against the viewer.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/files/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!/^(public|private)\/[a-z]+\/[\w./-]+$/.test(key) || key.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  // A signed link (privateFileLink: the app opening a CV) already proves access, for a few minutes.
  const query = new URL(req.url).searchParams;
  const signedLink = key.startsWith("private/") && storageDriver() === "local" && verifyFileLink(key, query.get("exp"), query.get("sig"));

  if (key.startsWith("private/") && !signedLink) {
    // The website sends its session cookie; the app sends its sign-in token (chat images and voice messages).
    const session = (await auth.api.getSession({ headers: req.headers })) ?? (await getMobileSession(req));
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
        })) ||
        (await canSeeProfileCv(owner!, url, userId));
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

  // Streamed from disk, never loaded whole (chat files can be 100 MB). Video and audio players ask for byte ranges
  // ("bytes=start-end", "bytes=start-" or the last N bytes, "bytes=-N") to start playing and to seek.
  const asked = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  // A range that ends before it starts is invalid: ignored, and the whole file sent (as the HTTP spec says).
  const range = asked && (asked[1] || asked[2]) && !(asked[1] && asked[2] && Number(asked[2]) < Number(asked[1])) ? asked : null;
  let file = await openStored(key, range?.[1] ? { start: Number(range[1]), end: range[2] ? Number(range[2]) : undefined } : undefined);
  if (!file) return new NextResponse("Not found", { status: 404 });
  if (range && !range[1]) {
    // The last N bytes: only known once the file's size is.
    file.stream.cancel().catch(() => {});
    file = (await openStored(key, { start: Math.max(file.size - Number(range[2]), 0) }))!;
  } else if (range && Number(range[1]) >= file.size) {
    file.stream.cancel().catch(() => {});
    return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
  }
  const inline = file.mime.startsWith("image/") || file.mime.startsWith("audio/") || file.mime.startsWith("video/") || file.mime === "application/pdf";
  return new NextResponse(file.stream, {
    status: range ? 206 : 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.end - file.start + 1),
      ...(range && { "Content-Range": `bytes ${file.start}-${file.end}/${file.size}` }),
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": inline ? "inline" : "attachment",
      "Cache-Control": key.startsWith("public/") ? "public, max-age=31536000, immutable" : "private, max-age=300",
    },
  });
}
