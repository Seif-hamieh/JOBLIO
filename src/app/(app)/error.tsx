"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";

// Shown when a page fails to render (e.g. a timeout while the database wakes
// up) instead of the browser's "This page couldn't load".
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);
  return (
    <EmptyState
      className="mt-10"
      icon={<RefreshCw />}
      title={t("errors.pageTitle")}
      description={t("errors.pageBody")}
      action={
        <Button onClick={reset} pill>
          <RefreshCw /> {t("errors.retry")}
        </Button>
      }
    />
  );
}
