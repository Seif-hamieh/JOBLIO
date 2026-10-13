"use client";

import { CheckCircle2, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { useInstallPrompt } from "@/components/pwa/pwa";

/** The "Install app" control in Settings: a button where the browser offers installation,
 *  Share-menu instructions on iOS, and a confirmation when already running as the app. */
export function InstallApp() {
  const { t } = useI18n();
  const { state, install } = useInstallPrompt();

  if (state === "installed") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-mint-fg">
        <CheckCircle2 className="size-4" aria-hidden />
        {t("pwa.installed")}
      </p>
    );
  }
  if (state === "ios") {
    return (
      <p className="flex items-start gap-2 text-sm text-fg-muted">
        <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("pwa.ios_hint")}
      </p>
    );
  }
  if (state === "unsupported") {
    return <p className="text-sm text-fg-muted">{t("pwa.browser_hint")}</p>;
  }
  return (
    <Button
      onClick={async () => {
        if ((await install()) === "dismissed") toast.info(t("pwa.install_dismissed"));
      }}
    >
      <Download className="size-4" aria-hidden />
      {t("pwa.install_now")}
    </Button>
  );
}
