"use client";

import { useI18n } from "@/i18n/client";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { Bookmark, Share2 } from "lucide-react";
import { toggleSaveJob } from "@/server/actions/jobs";
import { toast } from "@/components/ui/toast";
import { shareLink } from "@/lib/share";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MatchPill } from "@/components/match/match-ring";
import { MatchBreakdown } from "@/components/match/match-breakdown";
import type { MatchResult } from "@/lib/matching/engine";
import { cn } from "@/lib/utils";

export function SaveJobButton({
  jobId,
  saved,
  signedIn = true,
  variant = "icon",
}: {
  jobId: string;
  saved: boolean;
  signedIn?: boolean;
  variant?: "icon" | "button";
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) return router.push(`/login?next=/jobs/${jobId}`);
    start(async () => {
      setOptimistic(!optimistic);
      const res = await toggleSaveJob(jobId);
      if (!res?.ok) toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
      else toast.success(res.data?.saved ? t("jobs.savedToast") : t("jobs.unsavedToast"));
    });
  }

  if (variant === "button") {
    return (
      <Button variant="outline" size="lg" onClick={onClick} aria-pressed={optimistic}>
        <Bookmark className={cn(optimistic && "fill-current text-brand")} />
        {optimistic ? t("common.saved") : t("jobs.save")}
      </Button>
    );
  }
  return (
    <m.button
      type="button"
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      aria-pressed={optimistic}
      aria-label={optimistic ? t("jobs.unsave") : t("jobs.save")}
      className={cn(
        "relative z-10 grid size-9 place-items-center rounded-full transition-colors",
        optimistic ? "bg-brand-soft text-brand-soft-fg" : "text-fg-subtle hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Bookmark className={cn("size-[18px]", optimistic && "fill-current")} />
    </m.button>
  );
}

export function MatchButton({ match, title }: { match: MatchResult; title: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="relative z-10 rounded-full transition hover:scale-105"
        aria-label={t("match.seeHow", { n: match.score })}
      >
        <MatchPill score={match.score} />
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={t("match.title")} description={title}>
        <MatchBreakdown match={match} />
      </Dialog>
    </>
  );
}

export function ShareButton({ title, path }: { title: string; path: string }) {
  const { t } = useI18n();
  async function share() {
    const url = `${window.location.origin}${path}`;
    const result = await shareLink(title, url);
    if (result === "copied") toast.success(t("common.linkCopied"));
    else if (result === "failed") toast.error(t("common.copyFailed"), url);
  }
  return (
    <Button variant="outline" size="lg" onClick={share}>
      <Share2 /> {t("common.share")}
    </Button>
  );
}
