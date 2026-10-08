"use client";

import { DevMailboxHint } from "@/components/auth/dev-mailbox-hint";
import { useI18n } from "@/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { toast } from "@/components/ui/toast";

function Icon({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-soft-fg [&_svg]:size-6">{children}</div>;
}

export function ForgotPasswordForm({ devMailbox = false }: { devMailbox?: boolean }) {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const email = String(new FormData(e.currentTarget).get("email"));
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    // Always show the same confirmation, so this form can't reveal which emails have accounts.
    if (error?.status === 429) toast.error(authErrorMessage(error, t));
    else setSent(true);
  }

  if (sent) {
    return (
      <div>
        <Icon>
          <MailCheck />
        </Icon>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.checkEmail")}</h1>
        <p className="mt-3 text-fg-muted">{t("auth.resetSent")}</p>
        <DevMailboxHint show={devMailbox} />
        <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-soft-fg hover:underline">
          <ArrowLeft className="size-4" /> {t("auth.backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Icon>
        <KeyRound />
      </Icon>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.forgotTitle")}</h1>
      <p className="mt-2 text-fg-muted">{t("auth.forgotSub")}</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label={t("auth.email")}>{(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}</Field>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {t("auth.sendReset")}
        </Button>
      </form>
      <DevMailboxHint show={devMailbox} />
      <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {t("auth.backToSignIn")}
      </Link>
    </div>
  );
}

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(invalid || !token ? t("auth.resetInvalid") : null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error, t));
      return;
    }
    toast.success(t("auth.passwordUpdated"), t("auth.signInWithNew"));
    router.push("/login");
  }

  return (
    <div>
      <Icon>
        <KeyRound />
      </Icon>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.newPasswordTitle")}</h1>
      <p className="mt-2 text-fg-muted">{t("auth.newPasswordSub")}</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label={t("auth.newPassword")} hint={t("settings.passwordSub")}>
          {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} disabled={!token} />}
        </Field>
        <Field label={t("auth.confirmPassword")}>{(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" required disabled={!token} />}</Field>
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-fg">
            {error}{" "}
            {(invalid || !token) && (
              <Link href="/forgot-password" className="font-semibold underline">
                {t("auth.requestNew")}
              </Link>
            )}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={!token}>
          {t("auth.updatePassword")}
        </Button>
      </form>
    </div>
  );
}

export function ResendVerification({ email: initialEmail, error, devMailbox = false }: { email: string; error: boolean; devMailbox?: boolean }) {
  const { t } = useI18n();
  const [email, setEmail] = useState(initialEmail);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/onboarding" });
    setPending(false);
    if (error) toast.error(authErrorMessage(error, t));
    else setSent(true);
  }

  return (
    <div>
      <Icon>
        <MailCheck />
      </Icon>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{error ? t("auth.verifyBroken") : t("auth.verifyTitle")}</h1>
      <p className="mt-3 text-fg-muted">
        {error ? t("auth.verifyBrokenBody") : t("auth.verifyBody")}
      </p>
      <form onSubmit={resend} className="mt-8 space-y-4">
        <Field label={t("auth.email")}>{(p) => <Input {...p} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={sent}>
          {sent ? t("auth.sentCheck") : t("auth.resendVerify")}
        </Button>
      </form>
      <DevMailboxHint show={devMailbox} />
      <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {t("auth.backToSignIn")}
      </Link>
    </div>
  );
}
