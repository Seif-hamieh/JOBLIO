import { getI18n, pageTitle } from "@/i18n/server";
import Link from "next/link";
import { Building2, Check, Clock, Crown, Globe, Info, Megaphone, Rocket, ShieldCheck, Star, Users, Zap } from "lucide-react";
import { getViewer } from "@/server/session";
import { db } from "@/server/db";
import { paymentsMode } from "@/server/billing";
import {
  canFeatureJob,
  canMarkJobUrgent,
  featuredJobPlanOptions,
  paddleClientConfig,
  priorityApplicationPlanOptions,
  profileBoostPlanOptions,
  subscriptionPlanOptions,
  urgentHirePlanOptions,
} from "@/server/paddle";
import { FeatureJobPicker, PaddlePaymentLink } from "@/components/jobs/feature-job-button";
import { ProfileBoostPicker } from "@/components/billing/profile-boost-button";
import { PriorityApplicationPicker } from "@/components/billing/priority-application-button";
import { UrgentHirePicker } from "@/components/billing/urgent-hire-button";
import { SubscriptionPicker } from "@/components/billing/subscription-picker";
import { BuyButton, PromoteJobBuy } from "@/components/billing/buy-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/motion";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  FEATURED_JOB_PLANS,
  PAYMENTS_PAUSED,
  PRIORITY_APPLICATION_PLANS,
  PRODUCTS,
  PROFILE_BOOST_PLANS,
  SUBSCRIPTION_PLANS,
  URGENT_HIRE_PLANS,
  type ProductCode,
} from "@/lib/billing/products";
import { PausedPlans, type PausedPlan } from "@/components/billing/paused-plans";

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

/** Stands in for a checkout button while payments are off: visibly disabled, nothing to click. */
function PaymentsSoon({ label }: { label: string }) {
  return (
    <Button variant="outline" className="w-full" disabled aria-disabled>
      <Clock /> {label}
    </Button>
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
  // Paused payments look like "disabled": the "coming soon" notice shows and every buy button is off.
  const mode = PAYMENTS_PAUSED ? "disabled" : paymentsMode();
  const signedIn = !!viewer;
  const [subs, jobs] = await Promise.all([
    viewer
      ? db.subscription.findMany({ where: { OR: [{ userId: viewer.id }, ...(viewer.company ? [{ companyId: viewer.company.id }] : [])], status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] }, currentPeriodEnd: { gt: new Date() } }, select: { product: true } })
      : [],
    viewer?.company ? db.job.findMany({ where: { companyId: viewer.company.id, status: "OPEN" }, select: { id: true, title: true, companyId: true, postedById: true, status: true, featuredUntil: true, urgentUntil: true }, orderBy: { publishedAt: "desc" } }) : [],
  ]);
  const has = new Set(subs.map((s) => s.product));
  // Featured Job goes through Paddle when it is configured: only jobs this member may feature right now.
  const paddleConfig = paddleClientConfig();
  // While payments are paused the plans still show (with their prices), from the plan lists themselves:
  // the checkout pickers need a Paddle config, so they never render and PausedPlans stands in for them.
  const days = <C extends string>({ code, durationDays, amount }: { code: C; durationDays: number; amount: number }) => ({ code, durationDays, amount });
  const featuredPlans = paddleConfig ? featuredJobPlanOptions() : PAYMENTS_PAUSED ? FEATURED_JOB_PLANS.map(days) : [];
  const boostPlans = paddleConfig ? profileBoostPlanOptions() : PAYMENTS_PAUSED ? PROFILE_BOOST_PLANS.map(days) : [];
  const priorityPlans = paddleConfig
    ? priorityApplicationPlanOptions()
    : PAYMENTS_PAUSED
      ? PRIORITY_APPLICATION_PLANS.map(({ code, credits, amount }) => ({ code, credits, amount }))
      : [];
  const featurable = jobs.filter((j) => canFeatureJob(viewer, j)).map(({ id, title }) => ({ id, title }));
  // Urgent Hire is independent of Featured: open jobs this member may flag that aren't urgent yet.
  const urgentPlans = paddleConfig ? urgentHirePlanOptions() : PAYMENTS_PAUSED ? URGENT_HIRE_PLANS.map(days) : [];
  const urgentable = jobs.filter((j) => canMarkJobUrgent(viewer, j)).map(({ id, title }) => ({ id, title }));
  // Subscriptions (Paddle): monthly + yearly per product.
  const subPlans = (product: "JOB_SEEKER_PRO" | "COMPANY_PREMIUM") =>
    paddleConfig
      ? subscriptionPlanOptions(product)
      : PAYMENTS_PAUSED
        ? SUBSCRIPTION_PLANS.filter((p) => p.product === product).map(({ code, interval, amount }) => ({ code, interval, amount }))
        : [];
  const seekerProPlans = subPlans("JOB_SEEKER_PRO");
  const companyPremiumPlans = subPlans("COMPANY_PREMIUM");

  // The same labels as the pickers' buttons ("14 days — $3.00", "5 pack — $4.00", "Monthly — $7.00").
  const soon = t("premium.comingSoon");
  const byDays = (plans: { code: string; durationDays: number; amount: number }[]): PausedPlan[] =>
    plans.map((p) => ({ key: p.code, label: `${t("jobs.planDays", { n: p.durationDays })} — ${f.money(p.amount, "usd")}`, primary: p.durationDays === 14 }));
  const byInterval = (plans: { code: string; interval: string; amount: number }[]): PausedPlan[] =>
    plans.map((p) => ({ key: p.code, label: `${p.interval === "month" ? t("premium.planMonthly") : t("premium.planYearly")} — ${f.money(p.amount, "usd")}`, primary: p.interval === "month" }));
  // Paused: every plan, disabled, marked "Coming soon". Not configured (no plans): the single disabled button.
  const plansSoon = (plans: PausedPlan[], group: string) =>
    PAYMENTS_PAUSED && plans.length ? <PausedPlans plans={plans} soonLabel={soon} groupLabel={group} /> : <PaymentsSoon label={soon} />;
  const pausedPriority: PausedPlan[] = priorityPlans.map((p) => ({ key: p.code, label: `${t("premium.priorityPack", { n: p.credits })} — ${f.money(p.amount, "usd")}`, primary: p.credits === 5 }));
  const target = typeof sp.target === "string" ? sp.target : null;
  const isAdmin = viewer?.company && (viewer.company.role === "OWNER" || viewer.company.role === "ADMIN");

  const name = (code: ProductCode) => t(`premium.products.${code}.name`);
  const tagline = (code: ProductCode) => t(`premium.products.${code}.tagline`);
  const features = (code: ProductCode) => t(`premium.products.${code}.features`).split("|");
  const price = (code: ProductCode) => f.money(PRODUCTS[code].amount, PRODUCTS[code].currency);
  const SHOW_LEGACY_PLANS = false;

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
        {mode === "disabled" && !paddleConfig && (
          // A small notice only: each plan's buttons already say "Coming soon".
          <p className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-fg-muted">
            <Clock className="size-3.5" aria-hidden /> {soon}
          </p>
        )}
      </Reveal>

      {/* Members */}
      <section>
        <h2 className={`mb-6 flex items-center gap-2 font-display text-xl font-semibold ${SHOW_LEGACY_PLANS ? "" : "text-center justify-center"}`}>
          <Rocket className="size-5 text-ember" /> {t("premium.forPros")}
        </h2>
        <div className={`grid gap-5 ${SHOW_LEGACY_PLANS ? "lg:grid-cols-4" : "lg:grid-cols-1 max-w-md mx-auto"}`}>
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
          <Card className="flex flex-col p-6">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ember-fg">
              <Rocket className="size-4" /> {name("PROFILE_BOOST")}
            </div>
            {boostPlans.length ? (
              <Price amount={t("premium.fromPrice", { price: f.money(Math.min(...boostPlans.map((p) => p.amount)), "usd") })} suffix="" />
            ) : (
              <Price amount={price("PROFILE_BOOST")} suffix={t("premium.perDays", { n: PRODUCTS.PROFILE_BOOST.days ?? 0 })} />
            )}
            <p className="mt-1 text-sm text-fg-muted">{tagline("PROFILE_BOOST")}</p>
            <Features items={features("PROFILE_BOOST")} tone="text-ember" />
            <div className="mt-6">
              {paddleConfig && boostPlans.length ? (
                <ProfileBoostPicker plans={boostPlans} signedIn={signedIn} config={paddleConfig} />
              ) : (
                plansSoon(byDays(boostPlans), name("PROFILE_BOOST"))
              )}
            </div>
          </Card>
          <Card className="flex flex-col p-6">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-soft-fg">
              <Zap className="size-4" /> {name("PRIORITY_APPLICATION")}
            </div>
            {priorityPlans.length ? (
              <Price amount={t("premium.fromPrice", { price: f.money(Math.min(...priorityPlans.map((p) => p.amount)), "usd") })} suffix="" />
            ) : (
              <Price amount={price("PRIORITY_APPLICATION")} suffix="" />
            )}
            <p className="mt-1 text-sm text-fg-muted">{tagline("PRIORITY_APPLICATION")}</p>
            <Features items={features("PRIORITY_APPLICATION")} />
            <div className="mt-6">
              {paddleConfig && priorityPlans.length ? (
                <PriorityApplicationPicker plans={priorityPlans} signedIn={signedIn} config={paddleConfig} />
              ) : (
                plansSoon(pausedPriority, name("PRIORITY_APPLICATION"))
              )}
            </div>
          </Card>
          <Card className="flex flex-col p-6">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-aurora-fg">
              <Crown className="size-4" /> {name("JOB_SEEKER_PRO")}
            </div>
            {seekerProPlans.length ? (
              <Price amount={t("premium.fromPrice", { price: f.money(Math.min(...seekerProPlans.map((p) => p.amount)), "usd") })} suffix="" />
            ) : (
              <Price amount={price("JOB_SEEKER_PRO")} suffix={t("premium.perMonth")} />
            )}
            <p className="mt-1 text-sm text-fg-muted">{tagline("JOB_SEEKER_PRO")}</p>
            <Features items={features("JOB_SEEKER_PRO")} tone="text-aurora" />
            <div className="mt-6">
              {paddleConfig && seekerProPlans.length ? (
                <SubscriptionPicker
                  product="JOB_SEEKER_PRO"
                  plans={seekerProPlans}
                  config={paddleConfig}
                  signedIn={signedIn}
                  isSubscribed={has.has("JOB_SEEKER_PRO")}
                  manageHref="/settings/billing"
                />
              ) : (
                plansSoon(byInterval(seekerProPlans), name("JOB_SEEKER_PRO"))
              )}
            </div>
          </Card>
          {SHOW_LEGACY_PLANS && (["CAREER_BOOST_7", "CAREER_BOOST_30"] as const).map((code, i) => (
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
          {SHOW_LEGACY_PLANS && (
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
          )}
        </div>
        {SHOW_LEGACY_PLANS && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-fg-subtle">
          <ShieldCheck className="size-3.5" /> {t("premium.boostNote")}
        </p>
        )}
      </section>

      {/* Business */}
      <section id="business" className="scroll-mt-24">
        <h2 className={`mb-6 flex items-center gap-2 font-display text-xl font-semibold ${SHOW_LEGACY_PLANS ? "" : "text-center justify-center"}`}>
          <Building2 className="size-5 text-brand" /> {t("premium.forBusiness")}
        </h2>
        <div className={`grid gap-5 ${SHOW_LEGACY_PLANS ? "lg:grid-cols-4" : "lg:grid-cols-1 max-w-md mx-auto"}`}>
          {SHOW_LEGACY_PLANS && (
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
          )}
          {SHOW_LEGACY_PLANS && (
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
          )}
          {(["FEATURED_JOB"] as const).map((code) => {
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
                    ) : PAYMENTS_PAUSED ? (
                      plansSoon(byDays(featuredPlans), name("FEATURED_JOB"))
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
          <div id="URGENT_HIRE" className="scroll-mt-24">
            <Card className={`flex h-full flex-col p-6 ${sp.product === "URGENT_HIRE" ? "ring-2 ring-brand" : ""}`}>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted">
                <Zap className="size-4" /> {name("URGENT_HIRE")}
              </div>
              {urgentPlans.length ? (
                <Price amount={t("premium.fromPrice", { price: f.money(Math.min(...urgentPlans.map((p) => p.amount)), "usd") })} suffix={t("premium.perJob")} />
              ) : (
                <Price amount={price("URGENT_HIRE")} suffix={t("premium.perJob")} />
              )}
              <p className="mt-1 text-sm text-fg-muted">{tagline("URGENT_HIRE")}</p>
              <Features items={features("URGENT_HIRE")} />
              <div className="mt-6">
                {viewer?.company && paddleConfig && urgentPlans.length ? (
                  <UrgentHirePicker jobs={urgentable} config={paddleConfig} plans={urgentPlans} signedIn={signedIn} />
                ) : PAYMENTS_PAUSED || viewer?.company ? (
                  plansSoon(byDays(urgentPlans), name("URGENT_HIRE"))
                ) : (
                  <p className="text-xs text-fg-subtle">{t("premium.workspacesOnly")}</p>
                )}
              </div>
            </Card>
          </div>
          <div id="COMPANY_PREMIUM" className="scroll-mt-24">
            <Card className="flex h-full flex-col p-6">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-ember-fg">
                <Crown className="size-4" /> {name("COMPANY_PREMIUM")}
              </div>
              {companyPremiumPlans.length ? (
                <Price
                  amount={t("premium.fromPrice", { price: f.money(Math.min(...companyPremiumPlans.map((p) => p.amount)), "usd") })}
                  suffix=""
                />
              ) : (
                <Price amount={price("COMPANY_PREMIUM")} suffix={t("premium.perMonth")} />
              )}
              <p className="mt-1 text-sm text-fg-muted">{tagline("COMPANY_PREMIUM")}</p>
              <Features items={features("COMPANY_PREMIUM")} tone="text-ember" />
              <div className="mt-6">
                {PAYMENTS_PAUSED ? (
                  plansSoon(byInterval(companyPremiumPlans), name("COMPANY_PREMIUM"))
                ) : !viewer?.company ? (
                  <Link href={viewer ? "/recruiter/setup" : "/register?intent=RECRUITER"} className={buttonClasses({ variant: "outline", className: "w-full" })}>
                    {t("premium.createWorkspace")}
                  </Link>
                ) : !isAdmin && !has.has("COMPANY_PREMIUM") ? (
                  <p className="text-xs text-fg-subtle">{t("premium.adminsOnly")}</p>
                ) : paddleConfig && companyPremiumPlans.length ? (
                  <SubscriptionPicker
                    product="COMPANY_PREMIUM"
                    plans={companyPremiumPlans}
                    config={paddleConfig}
                    signedIn={signedIn}
                    isSubscribed={has.has("COMPANY_PREMIUM")}
                    manageHref="/settings/billing"
                  />
                ) : (
                  <PaymentsSoon label={t("premium.comingSoon")} />
                )}
              </div>
            </Card>
          </div>
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
