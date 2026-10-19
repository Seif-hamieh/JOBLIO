"use client";

import { useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { useInstallPrompt } from "@/components/pwa/pwa";

/**
 * A compact "Install" button for the header.
 * - Chrome / Edge / Android: opens the browser's install dialog (the saved `beforeinstallprompt` event).
 * - iOS (no install prompt there): opens a dialog explaining Share → "Add to Home Screen".
 * - Already installed (standalone) or a browser that can't install: renders nothing.
 * The event itself is captured in pwa.tsx as soon as the app loads: the browser fires it once, early,
 * so a listener added when this button mounts could miss it.
 */
export function InstallPWA({ className }: { className?: string }) {
  const { t } = useI18n();
  const { state, install } = useInstallPrompt();
  const [iosHelp, setIosHelp] = useState(false);

  if (state !== "available" && state !== "ios") return null;

  const button = (
    <Button
      variant="outline"
      size="sm"
      pill
      className={cn("gap-1.5", className)}
      title={t("pwa.installAppTitle")}
      aria-label={t("pwa.installApp")}
      onClick={async () => {
        if (state === "ios") return setIosHelp(true);
        if ((await install()) === "dismissed") toast.info(t("pwa.install_dismissed"));
      }}
    >
      <Download aria-hidden />
      {/* Icon only on the narrowest phones, so the header doesn't crowd. */}
      <span className="hidden min-[400px]:inline">{t("pwa.installBtn")}</span>
    </Button>
  );

  if (state === "available") return button;

  return (
    <>
      {button}
      <Dialog
        open={iosHelp}
        onOpenChange={setIosHelp}
        size="sm"
        title={t("pwa.iosInstallTitle")}
        description={t("pwa.iosInstallBody")}
        footer={
          <div className="flex justify-end">
            <Button onClick={() => setIosHelp(false)}>{t("common.close")}</Button>
          </div>
        }
      >
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
              <Share className="size-4" aria-hidden />
            </span>
            <span>
              <span className="font-semibold">1.</span> {t("pwa.iosStepShare")}
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
              <SquarePlus className="size-4" aria-hidden />
            </span>
            <span>
              <span className="font-semibold">2.</span> {t("pwa.iosStepAdd")}
            </span>
          </li>
        </ol>
      </Dialog>
    </>
  );
}
