import "server-only";
import { db } from "@/server/db";
import { canManageCompany, type Viewer } from "@/server/session";

/** What the post composer can attach for this viewer. */
export async function composerData(viewer: Viewer) {
  const [projects, jobs, company] = await Promise.all([
    db.project.findMany({ where: { profileId: viewer.profileId }, select: { id: true, title: true }, orderBy: { position: "asc" } }),
    viewer.company ? db.job.findMany({ where: { companyId: viewer.company.id, status: "OPEN" }, select: { id: true, title: true }, orderBy: { publishedAt: "desc" } }) : [],
    // Posting as the company is for its owners and admins only (recruiters post as themselves).
    viewer.company && canManageCompany(viewer, viewer.company.id) ? { name: viewer.company.name, logoUrl: viewer.company.logoUrl } : null,
  ]);
  return { projects, jobs, company };
}
