"use client";

import { useI18n } from "@/i18n/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Divider } from "@/components/ui/misc";
import { SocialButtons } from "@/components/auth/social-buttons";
import { authClient, authErrorMessage } from "@/lib/auth-client";

export function LoginForm({ next, providers }: { next: string; providers: ("google" | "github")[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      rememberMe: form.get("remember") === "on",
      callbackURL: next,
    });
    if (error) {
      setError(authErrorMessage(error, t));
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("auth.welcomeBack")}</h1>
      <p className="mt-2 text-fg-muted">{t("auth.signInSub")}</p>

      <div className="mt-8">
        <SocialButtons providers={providers} callbackURL={next} />
        <Divider label={t("auth.orEmail")} className="my-6" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
        <Field label={t("auth.email")}>{(p) => <Input {...p} name="email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="you@example.com" />}</Field>
        <Field
          label={
            <span className="flex w-full items-center justify-between">
              {t("auth.password")}
              <Link href="/forgot-password" className="text-xs font-medium text-brand-soft-fg hover:underline">
                {t("auth.forgot")}
              </Link>
            </span>
          }
        >
          {(p) => (
            <div className="relative">
              <Input {...p} name="password" type={show ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required className="pe-11" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute end-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg" aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input type="checkbox" name="remember" defaultChecked className="size-4 rounded accent-[var(--brand)]" /> {t("auth.keepSignedIn")}
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-fg">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {t("auth.signIn")}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-fg-muted">
        {t("auth.newHere")}{" "}
        <Link href="/register" className="font-semibold text-brand-soft-fg hover:underline">
          {t("auth.createFree")}
        </Link>
      </p>
    </div>
  );
}
