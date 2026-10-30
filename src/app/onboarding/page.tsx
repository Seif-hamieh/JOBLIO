import { pageTitle } from "@/i18n/server";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/session";
import { listIndustries } from "@/server/services/companies";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-switcher";

export const generateMetadata = pageTitle("meta.welcome");

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { error } = await searchParams;
  const viewer = await getViewer();
  // Better Auth sends failed email verifications back here with ?error=…
  if (!viewer) redirect(error ? "/verify-email?error=1" : "/login?next=/onboarding");
  if (viewer.onboardedAt) redirect("/feed");
  const industries = await listIndustries();

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <header className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="relative px-5 pb-16 pt-6 outline-none sm:pt-12">
        <OnboardingWizard name={viewer.name} initialIntent={viewer.intent} hasCompany={!!viewer.company} industries={industries} />
      </main>
    </div>
  );
}
