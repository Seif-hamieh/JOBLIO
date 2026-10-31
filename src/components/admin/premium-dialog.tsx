"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Crown, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { grantPremium, loadPremiumStatus, revokePremium } from "@/server/actions/admin";
import type { ActionState } from "@/server/action";
import type { PremiumStatus } from "@/server/services/admin-premium";

const TIMED = ["JOB_SEEKER_PRO", "PROFILE_BOOST", "RECRUITER_PRO", "PREMIUM_PORTFOLIO", "COMPANY_PREMIUM"] as const;
type Timed = (typeof TIMED)[number];

/**
 * Admin → Users → Manage premium: a switch per feature (on gives it for the chosen days, off takes back what an
 * admin gave — never what the member paid for), and Priority Application credits. Changes apply at once.
 */
export function PremiumDialog({ user, open, onOpenChange }: { user: { id: string; name: string }; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [days, setDays] = useState<Record<string, number>>({});
  const [credits, setCredits] = useState(5);
  const [pending, start] = useTransition();

  const load = (done: (s: PremiumStatus) => void) =>
    loadPremiumStatus(user.id).then((res) => {
      if (res?.ok && res.data) done(res.data);
      else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });
  const reload = () => load(setStatus);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void load((s) => !cancelled && setStatus(s));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user.id]);
  const close = (o: boolean) => {
    if (!o) setStatus(null);
    onOpenChange(o);
  };

  const run = (action: () => Promise<ActionState<unknown>>) =>
    start(async () => {
      const res = await action();
      if (res?.ok) {
        if (res.message) toast.success(res.message);
        await reload();
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });

  const state = (code: Timed) => (code === "PROFILE_BOOST" ? { ...status!.profileBoost, granted: true, paid: false } : status!.plans[code]);
  const unavailable = (code: Timed) => (code === "COMPANY_PREMIUM" && !status?.company) || (code === "PROFILE_BOOST" && !status?.hasProfile);

  return (
    <Dialog open={open} onOpenChange={close} size="md" title={t("admin.premium.title", { name: user.name })} description={t("admin.premium.body")}>
      {!status ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          {TIMED.map((code) => {
            const s = state(code);
            const n = days[code] ?? 30;
            const off = unavailable(code);
            // A plan the member paid for (and no admin grant on top) can't be switched off here.
            const paidOnly = s.active && s.paid && !s.granted;
            return (
              <div key={code} className="rounded-2xl border border-border p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      {s.active && <Crown className="size-4 text-ember-fg" />}
                      {t(`premium.products.${code}.name`)}
                    </div>
                    <div className="mt-0.5 text-xs text-fg-muted">
                      {s.active
                        ? t(paidOnly ? "admin.premium.paidUntil" : "admin.premium.activeUntil", { date: f.date(s.until!, { day: "numeric", month: "short", year: "numeric" }) })
                        : off
                          ? t(code === "COMPANY_PREMIUM" ? "admin.premium.noCompany" : "admin.premium.noProfile")
                          : t("admin.premium.off")}
                    </div>
                  </div>
                  <Switch
                    checked={s.active}
                    disabled={pending || off || paidOnly}
                    onCheckedChange={(on) => run(() => (on ? grantPremium(user.id, code, n) : revokePremium(user.id, code)))}
                  />
                </div>
                {!off && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={366}
                      value={n}
                      onChange={(e) => setDays((d) => ({ ...d, [code]: Math.max(1, Math.min(366, Number(e.target.value) || 1)) }))}
                      className="h-8 w-20"
                      aria-label={t("admin.premium.days")}
                    />
                    <span className="text-xs text-fg-muted">{t("admin.premium.days")}</span>
                    {s.active && (
                      <Button variant="outline" size="xs" className="ms-auto" disabled={pending} onClick={() => run(() => grantPremium(user.id, code, n))}>
                        <Plus /> {t("admin.premium.extend")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-2xl border border-border p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {status.priorityCredits > 0 && <Crown className="size-4 text-ember-fg" />}
                  {t("premium.products.PRIORITY_APPLICATION.name")}
                </div>
                <div className="mt-0.5 text-xs text-fg-muted">{t("admin.premium.credits", { n: status.priorityCredits })}</div>
              </div>
              {status.priorityCredits > 0 && (
                <Button variant="ghost" size="xs" className="text-danger-fg" disabled={pending} onClick={() => run(() => revokePremium(user.id, "PRIORITY_APPLICATION"))}>
                  <RotateCcw /> {t("admin.premium.resetCredits")}
                </Button>
              )}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={50}
                value={credits}
                onChange={(e) => setCredits(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="h-8 w-20"
                aria-label={t("admin.premium.creditsLabel")}
              />
              <Button size="xs" disabled={pending} onClick={() => run(() => grantPremium(user.id, "PRIORITY_APPLICATION", credits))}>
                <Plus /> {t("admin.premium.addCredits")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
