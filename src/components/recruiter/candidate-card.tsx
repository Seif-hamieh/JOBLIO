"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { Briefcase, Crown, MapPin } from "lucide-react";
import type { CandidateResult } from "@/server/services/recruiter";
import { Avatar } from "@/components/ui/avatar";
import { Badge, OpenToWorkBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { MatchRing } from "@/components/match/match-ring";
import { MatchHighlights } from "@/components/match/match-breakdown";
import { SaveCandidateButton } from "@/components/recruiter/save-candidate-button";
import { LevelBars } from "@/components/skills/level-picker";
import { cn } from "@/lib/utils";

export function CandidateCard({ c, saved, highlightSkills, jobId }: { c: CandidateResult; saved: boolean; highlightSkills: string[]; jobId?: string }) {
  const { t, f } = useI18n();
  const p = c.profile!;
  const href = `/recruiter/candidates/${c.username}${jobId ? `?job=${jobId}` : ""}`;
  return (
    <article className={cn("surface surface-hover relative p-5", c.featured && "ring-1 ring-ember/40")}>
      <div className="flex items-start gap-4">
        <Avatar name={c.name} src={c.image} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href} className="font-display font-semibold after:absolute after:inset-0">
              {c.name}
            </Link>
            {c.featured && (
              <Badge tone="ember" size="xs">
                <Crown /> {t("common.featured")}
              </Badge>
            )}
            {p.openToWork && <OpenToWorkBadge className="scale-90" />}
          </div>
          <p className="line-clamp-1 text-sm text-fg-muted">{p.headline}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-subtle">
            {(p.city || p.countryCode) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {f.location(p.city, p.countryCode)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Briefcase className="size-3" /> {f.years(p.yearsExperience)}
            </span>
            <span>{t(`enums.availability.${p.availability}`)}</span>
          </div>
        </div>
        {c.match && <MatchRing score={c.match.score} size={58} stroke={5} />}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {p.skills.slice(0, 7).map((s) => (
          <span
            key={s.skillId}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs",
              highlightSkills.includes(s.skill.slug) ? "border-brand/40 bg-brand-soft text-brand-soft-fg" : "border-border text-fg-muted",
            )}
          >
            {s.skill.name} <LevelBars level={s.level} />
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {c.match ? <MatchHighlights match={c.match} /> : <span />}
        <div className="relative z-10 flex gap-2">
          <SaveCandidateButton candidateId={c.id} saved={saved} />
          <Link href={`/messages?to=${c.id}${jobId ? `&job=${jobId}` : ""}`} className={buttonClasses({ size: "sm", variant: "outline", pill: true })}>
            {t("recruiter.contact")}
          </Link>
        </div>
      </div>
    </article>
  );
}
