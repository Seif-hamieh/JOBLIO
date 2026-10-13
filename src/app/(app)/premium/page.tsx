import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Building2, Check, Crown, Globe, Info, Megaphone, Rocket, ShieldCheck, Star, Users } from "lucide-react";
import { getViewer } from "@/server/session";
import { db } from "@/server/db";
import { paymentsMode } from "@/server/billing";
import { canFeatureJob, featuredJobPlanOptions, paddleClientConfig } from "@/server/paddle";
import { FeatureJobPicker, PaddlePaymentLink } from "@/components/jobs/feature-job-button";
import { BuyButton, PromoteJobBuy } from "@/components/billing/buy-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/motion";
import { buttonClasses } from "@/components/ui/button";
import { PRODUCTS, type ProductCode } from "@/lib/billing/products";

export const generateMetadata = pageTitle("nav.premium");

function Features({ items, tone = "text-mint" }: { items: string[]; tone?: string }) {
  return (
    <ul className="mt-5 flex-1 space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm">
          <Check className={`mt-0.5 size-4 shrink-0 ${tone}`} strokeWidth={2.5} /> {item}
        </li>
      ))}
    </ul>
  );
}

function Price({ amount, suffix }: { amount: string; suffix: string }) {
  return (
    <div className="mt-3 font-display text-4xl font-semibold tracking-tight">
      {amount}
      <span className="text-base font-normal text-fg-muted"> {suffix}</span>
    </div>
  );
}

export default async function PremiumPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const [viewer, { t, f }] = await Promise.all([getViewer(), getI18n()]);
  const mode = paymentsMode();
  const signedIn = !!viewer;
  const [subs, jobs] = await Promise.all([
    viewer
      ? db.subscription.findMany({ where: { OR: [{ userId: viewer.id }, ...(viewer.company ? [{ companyId: viewer.company.id }] : [])], status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] }, currentPeriodEnd: { gt: new Date() } }, select: { product: true } })
      : [],
    viewer?.company ? db.job.findMany({ where: { companyId: viewer.company.id, status: "OPEN" }, select: { id: true, title: true, companyId: true, postedById: true, status: true, featuredUntil: true }, orderBy: { publishedAt: "desc" } }) : [],
  ]);
  const has = new Set(subs.map((s) => s.product));
  // Featured Job goes through Paddle when it is configured: only jobs this member may feature right now.
  const paddleConfig = paddleClientConfig();
  const featuredPlans = paddleConfig ? featuredJobPlanOptions() : [];
  const featurable = jobs.filter((j) => canFeatureJob(viewer, j)).map(({ id, title }) => ({ id, title }));
  const target = typeof sp.target === "string" ? sp.target : null;
  const isAdmin = viewer?.company && (viewer.company.role === "OWNER" || viewer.company.role === "ADMIN");

  const name = (code: ProductCode) => t(`premium.products.${code}.name`);
  const tagline = (code: ProductCode) => t(`premium.products.${code}.tagline`);
  const features = (code: ProductCode) => t(`premium.products.${code}.features`).split("|");
  const price = (code: ProductCode) => f.money(PRODUCTS[code].amount, PRODUCTS[code].currency);

  return (
    <div className="space-y-16 pb-10">
      {paddleConfig && typeof sp._ptxn === "string" && <PaddlePaymentLink config={paddleConfig} />}
      <Reveal className="mx-auto max-w-2xl pt-4 text-center">
        <Badge tone="ember" size="md">
          <Crown /> {t("premium.badge")}
        </Badge>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t("premium.title")}</h1>
        <p className="mt-4 text-lg text-fg-muted">{t("premium.sub")}</p>
        {sp.canceled && <p className="mx-auto mt-4 max-w-md rounded-xl bg-surface-2 px-4 py-2 text-sm text-fg-muted">{t("premium.canceled")}</p>}
        {mode === "simulate" && (
          <p className="mx-auto mt-4 flex max-w-lg items-start gap-2 rounded-xl border border-aurora/30 bg-aurora-soft px-4 py-2.5 text-start text-xs text-aurora-fg">
            <Info className="mt-0.5 size-4 shrink-0" /> {t("premium.simulate")}
          </p>
        )}
        {mode === "disabled" && !paddleConfig && <p className="mx-auto mt-4 max-w-md rounded-xl bg-surface-2 px-4 py-2 text-sm text-fg-muted">{t("premium.disabled")}</p>}
      </Reveal>

      {/* Members */}
      <section>
        <h2 className="mb-6 flex items-center gap-2 font-display text-xl font-semibold">
          <Rocket className="size-5 text-ember" /> {t("premium.forPros")}
        </h2>
        <div className="grid gap-5 lg:grid-cols-4">
          <Card className="flex flex-col p-6">
            <div className="text-sm font-semibold text-fg-muted">{t("premium.free")}</div>
            <Price amount={f.money(0)} suffix={t("premium.forever")} />
            <Features items={[t("premium.free1"), t("premium.free2"), t("premium.free3"), t("premium.free4"), t("premium.free5")]} />
            {!signedIn && (
              <Link href="/register" className={buttonClasses({ variant: "outline", className: "mt-6 w-full" })}>
                {t("common.joinFree")}
              </Link>
            )}
          </Card>
          {(["CAREER_BOOST_7", "CAREER_BOOST_30"] as const).map((code, i) => (
            <Card key={code} className={`relative flex flex-col overflow-hidden p-6 ${i === 1 ? "ring-2 ring-ember/50" : ""}`}>
              {i === 1 && (
                <span className="absolute end-4 top-4">
                  <Badge tone="ember" size="xs">
                    {t("premium.bestValue")}
                  </Badge>
                </span>
              )}
              <div className="text-sm font-semibold text-ember-fg">{name(code)}</div>
              <Price amount={price(code)} suffix={t("premium.perDays", { n: PRODUCTS[code].days ?? 0 })} />
              <p className="mt-1 text-sm text-fg-muted">{tagline(code)}</p>
              <Features items={features(code)} tone="text-ember" />
              <BuyButton product={code} signedIn={signedIn} disabled={mode === "disabled"} className="mt-6 w-full" variant={i === 1 ? "primary" : "outline"}>
                {viewer?.boosted ? t("premium.extendBoost") : t("premium.boostMe")}
              </BuyButton>
            </Card>
          ))}
          <Card className="flex flex-col p-6">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-aurora-fg">
              <Globe className="size-4" /> {name("PREMIUM_PORTFOLIO")}
            </div>
            <Price amount={price("PREMIUM_PORTFOLIO")} suffix={t("premium.perMonth")} />
            <p className="mt-1 text-sm text-fg-muted" dir={viewer ? "ltr" : undefined}>
              {viewer ? `getjoblio.app/${viewer.username}` : tagline("PREMIUM_PORTFOLIO")}
            </p>
            <Features items={features("PREMIUM_PORTFOLIO")} tone="text-aurora" />
            {has.has("PREMIUM_PORTFOLIO") ? (
              <Link href="/settings#portfolio" className={buttonClasses({ variant: "soft", className: "mt-6 w-full" })}>
                {t("premium.managePortfolio")}
              </Link>
            ) : (
              <BuyButton product="PREMIUM_PORTFOLIO" signedIn={signedIn} disabled={mode === "disabled"} className="mt-6 w-full" variant="outline">
                {t("premium.getPortfolio")}
              </BuyButton>
            )}
          </Card>
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-fg-subtle">
          <ShieldCheck className="size-3.5" /> {t("premium.boostNote")}
        </p>
      </section>

      {/* Business */}
      <section id="business" className="scroll-mt-24">
        <h2 className="mb-6 flex items-center gap-2 font-display text-xl font-semibold">
          <Building2 className="size-5 text-brand" /> {t("premium.forBusiness")}
        </h2>
        <div className="grid gap-5 lg:grid-cols-4">
          <Card className="flex flex-col p-6 ring-2 ring-brand/40">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-soft-fg">
              <Users className="size-4" /> {name("RECRUITER_PRO")}
            </div>
            <Price amount={price("RECRUITER_PRO")} suffix={t("premium.perMonth")} />
            <p className="mt-1 text-sm text-fg-muted">{tagline("RECRUITER_PRO")}</p>
            <Features items={features("RECRUITER_PRO")} />
            {has.has("RECRUITER_PRO") ? (
              <Badge tone="mint" size="md" className="mt-6 justify-center">
                {t("premium.active")}
              </Badge>
            ) : viewer?.company ? (
              <BuyButton product="RECRUITER_PRO" signedIn={signedIn} disabled={mode === "disabled"} className="mt-6 w-full">
                {t("premium.upgradePro")}
              </BuyButton>
            ) : (
              <Link href={viewer ? "/recruiter/setup" : "/register?intent=RECRUITER"} className={buttonClasses({ className: "mt-6 w-full" })}>
                {t("premium.createWorkspace")}
              </Link>
            )}
          </Card>
          <Card className="flex flex-col p-6">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ember-fg">
              <Crown className="size-4" /> {name("COMPANY_PREMIUM")}
            </div>
            <Price amount={price("COMPANY_PREMIUM")} suffix={t("premium.perMonth")} />
            <p className="mt-1 text-sm text-fg-muted">{tagline("COMPANY_PREMIUM")}</p>
            <Features items={features("COMPANY_PREMIUM")} tone="text-ember" />
            {has.has("COMPANY_PREMIUM") ? (
              <Badge tone="mint" size="md" className="mt-6 justify-center">
                {t("premium.active")}
              </Badge>
            ) : isAdmin ? (
              <BuyButton product="COMPANY_PREMIUM" signedIn={signedIn} disabled={mode === "disabled"} className="mt-6 w-full" variant="outline">
                {t("premium.upgradeCompany")}
              </BuyButton>
            ) : (
              <p className="mt-6 text-xs text-fg-subtle">{t("premium.adminsOnly")}</p>
            )}
          </Card>
          {(["FEATURED_JOB", "SPONSORED_JOB"] as const).map((code) => {
            const Icon = code === "FEATURED_JOB" ? Star : Megaphone;
            return (
              <div key={code} id={code} className="scroll-mt-24">
                <Card className={`flex h-full flex-col p-6 ${sp.product === code ? "ring-2 ring-brand" : ""}`}>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted">
                    <Icon className="size-4" /> {name(code)}
                  </div>
                  {code === "FEATURED_JOB" && featuredPlans.length ? (
                    <Price amount={t("premium.fromPrice", { price: f.money(Math.min(...featuredPlans.map((p) => p.amount)), "usd") })} suffix={t("premium.perJob")} />
                  ) : (
                    <Price amount={price(code)} suffix={t("premium.perJob")} />
                  )}
                  <p className="mt-1 text-sm text-fg-muted">{tagline(code)}</p>
                  <Features items={features(code)} />
                  <div className="mt-6">
                    {viewer?.company && code === "FEATURED_JOB" && paddleConfig ? (
                      <FeatureJobPicker jobs={featurable} initialJob={sp.product === code ? target : null} config={paddleConfig} plans={featuredPlans} />
                    ) : viewer?.company ? (
                      <PromoteJobBuy
                        product={code}
                        jobs={jobs.map(({ id, title }) => ({ id, title }))}
                        initialJob={sp.product === code ? target : null}
                        signedIn={signedIn}
                        label={code === "FEATURED_JOB" ? t("premium.featureJob") : t("premium.sponsorJob")}
                      />
                    ) : (
                      <p className="text-xs text-fg-subtle">{t("premium.workspacesOnly")}</p>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-center font-display text-xl font-semibold">{t("premium.questions")}</h2>
        <div className="space-y-3">
          {([1, 2, 3, 4] as const).map((n) => (
            <details key={n} className="surface group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between font-medium">
                {t(`premium.q${n}`)}
                <span className="text-fg-subtle transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-fg-muted">{t(`premium.a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
