"use client";

import { PasswordStrength } from "@/components/auth/password-strength";
import { assessPassword } from "@/lib/password";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CreditCard, ExternalLink, Globe, KeyRound, LogOut, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/controls";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";
import { clearCachedPages } from "@/components/pwa/pwa";
import { MESSAGE_PERMISSIONS, PROFILE_VISIBILITIES, type MessagePermission, type ProfileVisibility } from "@/lib/constants";
import { updatePortfolioAction, updatePrivacyAction } from "@/server/actions/profile";
import { toggleBlockAction } from "@/server/actions/network";
import { billingPortalAction, cancelSubscriptionAction } from "@/server/actions/billing";
import {
  changePasswordAction,
  deleteAccountAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  updateNotificationSettingsAction,
} from "@/server/actions/settings";
import type { ActionState } from "@/server/action";

/** Runs a server action and reports its (already translated) result. */
function useAction() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState<unknown>>, onOk?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res?.ok) {
        // Every successful save says so, even when the server sends no message.
        toast.success(res.message ?? t("common.saved"));
        onOk?.();
        router.refresh();
      } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
    });
  return { pending, run };
}

/** Save button that also tells you when there are changes you haven't saved yet. */
function SaveBar({ dirty, pending, onSave, label }: { dirty: boolean; pending: boolean; onSave: () => void; label: string }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-end gap-3">
      {dirty && (
        <span role="status" className="text-xs font-medium text-ember-fg">
          {t("settings.unsaved")}
        </span>
      )}
      <Button loading={pending} onClick={onSave}>
        {label}
      </Button>
    </div>
  );
}

// ── Notifications ────────────────────────────────────────────────────────

export type NotificationPrefs = {
  emailNotifications: boolean;
  notifyMessages: boolean;
  notifyApplications: boolean;
  notifyNetwork: boolean;
  notifyJobAlerts: boolean;
  notifyPosts: boolean;
  notifyProfileViews: boolean;
};

const NOTIFY_ROWS = [
  ["notifyMessages", "settings.nMessages"],
  ["notifyApplications", "settings.nApplications"],
  ["notifyNetwork", "settings.nNetwork"],
  ["notifyJobAlerts", "settings.nJobAlerts"],
  ["notifyPosts", "settings.nPosts"],
  ["notifyProfileViews", "settings.nViews"],
] as const;

export function NotificationSettingsForm({ initial }: { initial: NotificationPrefs }) {
  const { t } = useI18n();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const { pending, run } = useAction();
  const set = (k: keyof NotificationPrefs, val: boolean) => setV((x) => ({ ...x, [k]: val }));
  return (
    <div className="space-y-4">
      <Switch checked={v.emailNotifications} onCheckedChange={(x) => set("emailNotifications", x)} label={t("settings.nEmail")} description={t("settings.nEmailDesc")} />
      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        {NOTIFY_ROWS.map(([key, label]) => (
          <Switch key={key} checked={v[key]} onCheckedChange={(x) => set(key, x)} label={t(label)} />
        ))}
      </div>
      <SaveBar dirty={dirty} pending={pending} label={t("common.save")} onSave={() => run(() => updateNotificationSettingsAction(v), () => setSaved(v))} />
    </div>
  );
}

// ── Password ─────────────────────────────────────────────────────────────

export function ChangePasswordForm() {
  const { t } = useI18n();
  const [v, setV] = useState({ currentPassword: "", newPassword: "" });
  const { pending, run } = useAction();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("settings.currentPassword")}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} />}
      </Field>
      <Field label={t("settings.newPassword")} hint={t("settings.passwordSub")}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" minLength={10} value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} />}
      </Field>
      <div className="sm:col-span-2">
        <PasswordStrength password={v.newPassword} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <Button
          loading={pending}
          disabled={!v.currentPassword || !!assessPassword(v.newPassword).problem}
          onClick={() => run(() => changePasswordAction(v), () => setV({ currentPassword: "", newPassword: "" }))}
        >
          <KeyRound /> {t("settings.changePassword")}
        </Button>
      </div>
    </div>
  );
}

// ── Portfolio ────────────────────────────────────────────────────────────

export function PortfolioForm({ username, enabled, accent, entitled }: { username: string; enabled: boolean; accent: string | null; entitled: boolean }) {
  const { t } = useI18n();
  const [on, setOn] = useState(enabled);
  const [color, setColor] = useState(accent ?? "#5b46e5");
  const { pending, run } = useAction();
  return (
    <div className="space-y-4">
      <Switch
        checked={on}
        disabled={!entitled}
        onCheckedChange={setOn}
        label={t("settings.portfolioPublish")}
        description={entitled ? undefined : t("settings.portfolioNeeds")}
      />
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={color}
          disabled={!entitled}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-xl border border-border bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t("settings.portfolioAccent")}
        />
        <span className="text-sm text-fg-muted">{t("settings.portfolioAccent")}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={`/${username}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-soft-fg hover:underline" dir="ltr">
          <Globe className="size-4" /> getjoblio.app/{username}
        </a>
        <Button loading={pending} disabled={!entitled} onClick={() => run(() => updatePortfolioAction({ enabled: on, accent: color }))}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}

// ── Delete account ───────────────────────────────────────────────────────

export function DeleteAccount() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 /> {t("settings.deleteAccount")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={t("settings.danger")}
        description={t("settings.dangerSub")}
        footer={
          <Button
            variant="danger"
            loading={pending}
            disabled={confirm !== "DELETE"}
            onClick={() =>
              start(async () => {
                const res = await deleteAccountAction(confirm);
                if (res?.ok) {
                  toast.success(res.message ?? t("settings.deleted"));
                  await authClient.signOut().catch(() => {});
                  clearCachedPages();
                  router.push("/");
                  router.refresh();
                } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
              })
            }
          >
            {t("settings.deleteAccount")}
          </Button>
        }
      >
        <Field label={t("settings.deleteConfirm")}>{(p) => <Input {...p} value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" autoComplete="off" />}</Field>
      </Dialog>
    </>
  );
}

// ── Privacy ──────────────────────────────────────────────────────────────

export type PrivacyValue = {
  visibility: ProfileVisibility;
  searchableByRecruiters: boolean;
  privateBrowsing: boolean;
  messagePermission: MessagePermission;
  showConnections: boolean;
};

export function PrivacyForm({ initial }: { initial: PrivacyValue }) {
  const { t } = useI18n();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const { pending, run } = useAction();
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("privacy.visibility")} hint={t("privacy.visibilityHint")}>
          {(p) => (
            <Select {...p} value={v.visibility} onChange={(e) => setV({ ...v, visibility: e.target.value as ProfileVisibility })}>
              {PROFILE_VISIBILITIES.map((x) => (
                <option key={x} value={x}>
                  {t(`enums.visibility.${x}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("privacy.whoCanMessage")}>
          {(p) => (
            <Select {...p} value={v.messagePermission} onChange={(e) => setV({ ...v, messagePermission: e.target.value as MessagePermission })}>
              {MESSAGE_PERMISSIONS.map((x) => (
                <option key={x} value={x}>
                  {t(`enums.messagePermission.${x}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="space-y-4 border-t border-border pt-4">
        <Switch checked={v.searchableByRecruiters} onCheckedChange={(x) => setV({ ...v, searchableByRecruiters: x })} label={t("privacy.searchable")} description={t("privacy.searchableDesc")} />
        <Switch checked={v.privateBrowsing} onCheckedChange={(x) => setV({ ...v, privateBrowsing: x })} label={t("privacy.privateBrowsing")} description={t("privacy.privateBrowsingDesc")} />
        <Switch checked={v.showConnections} onCheckedChange={(x) => setV({ ...v, showConnections: x })} label={t("privacy.showConnections")} />
      </div>
      <SaveBar dirty={dirty} pending={pending} label={t("privacy.save")} onSave={() => run(() => updatePrivacyAction(v), () => setSaved(v))} />
    </div>
  );
}

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const { t } = useI18n();
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => revokeSessionAction(sessionId))}>
      <LogOut /> {t("privacy.revoke")}
    </Button>
  );
}

export function RevokeOthersButton() {
  const { t } = useI18n();
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => revokeOtherSessionsAction())}>
      <LogOut /> {t("privacy.revokeOthers")}
    </Button>
  );
}

export function UnblockButton({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant="outline" pill loading={pending} onClick={() => run(() => toggleBlockAction(userId))}>
      {t("privacy.unblock")}
    </Button>
  );
}

// ── Billing ──────────────────────────────────────────────────────────────

export function SubscriptionToggle({ subscriptionId, cancelAtPeriodEnd }: { subscriptionId: string; cancelAtPeriodEnd: boolean }) {
  const { t } = useI18n();
  const { pending, run } = useAction();
  return (
    <Button size="sm" variant={cancelAtPeriodEnd ? "soft" : "ghost"} loading={pending} onClick={() => run(() => cancelSubscriptionAction(subscriptionId, !cancelAtPeriodEnd))}>
      {cancelAtPeriodEnd ? t("billing.resumePlan") : t("billing.cancelPlan")}
    </Button>
  );
}

export function PaymentMethodsButton() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await billingPortalAction();
          if (res?.ok && res.data) window.location.assign(res.data.url);
          else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
        })
      }
    >
      <CreditCard /> {t("billing.manageMethods")}
    </Button>
  );
}

/** Paddle's customer portal in a new tab. The tab is opened on click (popup blockers allow that), then pointed at the portal link. */
export function ManageSubscriptionButton() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      loading={pending}
      onClick={() => {
        const tab = window.open("about:blank", "_blank");
        if (tab) tab.opener = null;
        start(async () => {
          const res = await billingPortalAction();
          if (res?.ok && res.data) {
            if (tab) tab.location.href = res.data.url;
            else window.location.assign(res.data.url);
          } else {
            tab?.close();
            toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
          }
        });
      }}
    >
      <ExternalLink /> {t("billing.manageSubscription")}
    </Button>
  );
}

export function PrintButton() {
  const { t } = useI18n();
  return (
    <Button variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer /> {t("billing.print")}
    </Button>
  );
}