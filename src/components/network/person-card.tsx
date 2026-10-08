"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { resolveMessage } from "@/i18n/message";
import { Crown } from "lucide-react";
import type { PersonCard as PersonData } from "@/server/services/network";
import { Avatar } from "@/components/ui/avatar";
import { OpenToWorkBadge } from "@/components/ui/badge";
import { ConnectButton, type RelationState } from "@/components/network/connect-button";
import { cn } from "@/lib/utils";

export function PersonCard({
  person,
  relation,
  reason,
  compact,
  className,
}: {
  person: PersonData;
  relation: { state: RelationState; connectionId?: string };
  reason?: string;
  compact?: boolean;
  className?: string;
}) {
  const { t, f } = useI18n();
  const why = reason ? resolveMessage(t, reason) : undefined;
  const p = person.profile;
  const boosted = !!p?.featuredUntil && p.featuredUntil > new Date();
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <Link href={`/in/${person.username}`}>
          <Avatar name={person.name} src={person.image} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/in/${person.username}`} className="block truncate text-sm font-semibold hover:underline">
            {person.name}
          </Link>
          <div className="truncate text-xs text-fg-muted">{why ?? p?.headline}</div>
        </div>
        <ConnectButton userId={person.id!} name={person.name} state={relation.state} connectionId={relation.connectionId} />
      </div>
    );
  }
  return (
    <div className={cn("surface surface-hover flex flex-col items-center overflow-hidden text-center", className)}>
      <div className="h-14 w-full bg-gradient-to-r from-brand/25 via-aurora/20 to-mint/20" />
      <Link href={`/in/${person.username}`} className="-mt-8">
        <Avatar name={person.name} src={person.image} size="lg" ring />
      </Link>
      <div className="flex w-full flex-1 flex-col items-center px-4 pb-4 pt-2">
        <Link href={`/in/${person.username}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
          {person.name}
          {boosted && <Crown className="size-3.5 text-ember" aria-label={t("common.premium")} />}
        </Link>
        <p className="mt-0.5 line-clamp-2 min-h-[2.5em] text-xs text-fg-muted">{p?.headline ?? t("network.member")}</p>
        {p?.city && <p className="mt-1 text-[11px] text-fg-subtle">{f.location(p.city, p.countryCode)}</p>}
        {p?.openToWork && <OpenToWorkBadge className="mt-2" />}
        {why && <p className="mt-2 text-[11px] font-medium text-brand-soft-fg">{why}</p>}
        <div className="mt-auto w-full pt-3">
          <ConnectButton userId={person.id!} name={person.name} state={relation.state} connectionId={relation.connectionId} className="w-full" />
        </div>
      </div>
    </div>
  );
}
