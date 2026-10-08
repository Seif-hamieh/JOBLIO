import { getI18n, pageTitle } from "@/i18n/server";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { requireViewer } from "@/server/session";
import { listIndustries } from "@/server/services/companies";
import { RecruiterSetupForm } from "@/components/recruiter/setup-form";
import { Card } from "@/components/ui/misc";

export const generateMetadata = pageTitle("recruiter.setupTitle");

export default async function RecruiterSetupPage() {
  const [viewer, { t }] = await Promise.all([requireViewer(), getI18n()]);
  if (viewer.company) redirect("/recruiter");
  const industries = await listIndustries();
  return (
    <div className="mx-auto grid max-w-5xl gap-8 py-4 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("recruiter.setupTitle")}</h1>
        <p className="mt-3 text-fg-muted">{t("recruiter.setupSub")}</p>
        <ul className="mt-6 space-y-3">
          {[t("recruiter.setupF1"), t("recruiter.setupF2"), t("recruiter.setupF3"), t("recruiter.setupF4"), t("recruiter.setupF5")].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm">
              <span className="grid size-5 place-items-center rounded-full bg-mint-soft text-mint-fg">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <Card className="p-6 sm:p-8">
        <RecruiterSetupForm industries={industries} />
      </Card>
    </div>
  );
}
