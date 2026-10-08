import { getI18n, pageTitle } from "@/i18n/server";
import { requireViewer } from "@/server/session";
import { db } from "@/server/db";
import { ProjectManager } from "@/components/profile/project-manager";
import { PageHeader } from "@/components/ui/misc";

export const generateMetadata = pageTitle("profile.projects");

export default async function ProjectsPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  const projects = await db.project.findMany({
    where: { profileId: viewer.profileId },
    orderBy: [{ featured: "desc" }, { position: "asc" }],
    include: { skills: { select: { id: true, name: true } } },
  });
  return (
    <div className="space-y-6">
      <PageHeader title={t("profileEdit.projectsTitle")} description={t("profileEdit.projectsSub")} />
      <ProjectManager items={projects} />
    </div>
  );
}
