"use client";

import { useI18n } from "@/i18n/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { toast } from "@/components/ui/toast";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-7.9Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.3 4.8 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function SocialButtons({ providers, callbackURL, onBeforeRedirect }: { providers: ("google" | "github")[]; callbackURL: string; onBeforeRedirect?: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const { t } = useI18n();

  async function go(provider: "google" | "github") {
    // Google is always offered; until its keys are configured, explain instead of failing.
    if (!providers.includes(provider)) {
      toast.info(t("auth.googleNotSetUp"));
      return;
    }
    setPending(provider);
    onBeforeRedirect?.();
    const { error } = await authClient.signIn.social({ provider, callbackURL, newUserCallbackURL: "/onboarding" });
    if (error) {
      toast.error(authErrorMessage(error, t));
      setPending(null);
    }
  }

  return (
    <div className="grid gap-2.5">
      {(
        <Button variant="outline" size="lg" onClick={() => go("google")} loading={pending === "google"} className="w-full">
          <GoogleIcon /> {t("auth.google")}
        </Button>
      )}
      {providers.includes("github") && (
        <Button variant="outline" size="lg" onClick={() => go("github")} loading={pending === "github"} className="w-full">
          <GitHubIcon /> {t("auth.github")}
        </Button>
      )}
    </div>
  );
}
