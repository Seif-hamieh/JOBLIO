"use client";

import { DevMailboxHint } from "@/components/auth/dev-mailbox-hint";
import { useI18n } from "@/i18n/client";
import type { TKey } from "@/i18n/translate";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { useState } from "react";
import { ArrowLeft, Briefcase, Check, MailCheck, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Divider } from "@/components/ui/misc";
import { SocialButtons } from "@/components/auth/social-buttons";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { UserIntent } from "@/lib/constants";

const INTENTS: { value: UserIntent; title: TKey; body: TKey; icon: typeof Search }[] = [
  { value: "SEEKER", title: "auth.intentSeeker", body: "auth.intentSeekerBody", icon: Search },
  { value: "RECRUITER", title: "auth.intentRecruiter", body: "auth.intentRecruiterBody", icon: Briefcase },
  { value: "BOTH", title: "auth.intentBoth", body: "auth.intentBothBody", icon: Sparkles },
];

export const INTENT_STORAGE_KEY = "joblio:intent";

function passwordStrength(pw: string) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export function RegisterForm({ initialIntent, providers, devMailbox = false }: { initialIntent: UserIntent | null; providers: ("google" | "github")[]; devMailbox?: boolean }) {
  const { t, dir } = useI18n();
  const s = dir === "rtl" ? -1 : 1;
  const [step, setStep] = useState<0 | 1 | 2>(initialIntent ? 1 : 0);
  const [intent, setIntent] = useState<UserIntent>(initialIntent ?? "SEEKER");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const strength = passwordStrength(password);

  const rememberIntent = () => {
    try {
      localStorage.setItem(INTENT_STORAGE_KEY, intent);
    } catch {}
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    rememberIntent();
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      email: String(form.get("email")).trim(),
      password,
      intent,
      callbackURL: "/onboarding",
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error, t));
      return;
    }
    setStep(2);
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === 0 && (
        <m.div key="intent" initial={{ opacity: 0, x: -12 * s }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 * s }}>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.howUse")}</h1>
          <p className="mt-2 text-fg-muted">{t("auth.changeLater")}</p>
          <div className="mt-8 space-y-3" role="radiogroup">
            {INTENTS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={intent === o.value}
                onClick={() => setIntent(o.value)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-2xl border p-4 text-start transition-all duration-200",
                  intent === o.value ? "border-brand bg-brand-soft/60 shadow-card" : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl transition-colors", intent === o.value ? "bg-brand text-brand-fg" : "bg-surface-2 text-fg-muted")}>
                  <o.icon className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{t(o.title)}</span>
                  <span className="block text-sm text-fg-muted">{t(o.body)}</span>
                </span>
                <span className={cn("grid size-5 place-items-center rounded-full border-2 transition", intent === o.value ? "border-brand bg-brand text-white" : "border-border-strong")}>
                  {intent === o.value && <Check className="size-3" strokeWidth={3.5} />}
                </span>
              </button>
            ))}
          </div>
          <Button size="lg" className="mt-6 w-full" onClick={() => setStep(1)}>
            {t("common.next")}
          </Button>
          <p className="mt-8 text-center text-sm text-fg-muted">
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="font-semibold text-brand-soft-fg hover:underline">
              {t("auth.signIn")}
            </Link>
          </p>
        </m.div>
      )}

      {step === 1 && (
        <m.div key="details" initial={{ opacity: 0, x: 12 * s }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 * s }}>
          <button onClick={() => setStep(0)} className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" /> {t(INTENTS.find((i) => i.value === intent)!.title)}
          </button>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.createAccount")}</h1>
          <p className="mt-2 text-fg-muted">{t("auth.freeForever")}</p>

          <div className="mt-8">
            <SocialButtons providers={providers} callbackURL="/home" onBeforeRedirect={rememberIntent} />
            <Divider label={t("auth.orEmail")} className="my-6" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label={t("auth.fullName")}>{(p) => <Input {...p} name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="Alex Morgan" />}</Field>
            <Field label={t("auth.email")}>
              {(p) => <Input {...p} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />}
            </Field>
            <Field label={t("auth.password")} hint={t("auth.passwordHint")}>
              {(p) => (
                <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </Field>
            {password && (
              <div className="flex gap-1.5" aria-label={`${strength}/4`}>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors duration-300",
                      i < strength ? (strength <= 1 ? "bg-danger" : strength === 2 ? "bg-ember" : "bg-mint") : "bg-surface-3",
                    )}
                  />
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-fg">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={pending}>
              {t("auth.createBtn")}
            </Button>
          </form>
        </m.div>
      )}

      {step === 2 && (
        <m.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <m.div
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 16 }}
            className="mx-auto grid size-16 place-items-center rounded-2xl bg-mint-soft text-mint-fg"
          >
            <MailCheck className="size-7" />
          </m.div>
          <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">{t("auth.checkInbox")}</h1>
          <p className="mt-3 text-fg-muted">
            {t("auth.sentVerify", { email })}
          </p>
          <Link href={`/verify-email?email=${encodeURIComponent(email)}`} className="mt-8 inline-block text-sm font-semibold text-brand-soft-fg hover:underline">
            {t("auth.resend")}
          </Link>
          <DevMailboxHint show={devMailbox} />
        </m.div>
      )}
    </AnimatePresence>
  );
}
