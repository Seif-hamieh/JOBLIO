"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Dialog as D } from "radix-ui";
import { AnimatePresence, m } from "motion/react";
import { ExternalLink, FileText, Gift, MapPin, MessageSquare, Star, X, XCircle } from "lucide-react";
import type { ApplicationDetail } from "@/server/services/recruiter";
import { addNoteAction, moveApplicationAction, openApplicationAction, rateApplicationAction, setApplicationStatusAction } from "@/server/actions/recruiter";
import type { MatchResult } from "@/lib/matching/engine";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/misc";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { LocalTime } from "@/components/ui/local-time";
import { MatchBreakdown } from "@/components/match/match-breakdown";
import { ScheduleInterviewButton } from "@/components/recruiter/schedule-interview";
import { LevelBars } from "@/components/skills/level-picker";
import { PIPELINE_STAGES, STATUS_FOR_STAGE, type ApplicationStatus, type PipelineStage } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { useFinalDecision } from "@/components/recruiter/final-decision";

const INTERVIEW_STATE_KEY = { PENDING: "interviews.awaiting", ACCEPTED: "interviews.confirmed", DECLINED: "interviews.declined", COMPLETED: "interviews.completed", CANCELLED: "interviews.cancelled" } as const;

type Patch = Partial<{ stage: PipelineStage; status: ApplicationStatus; rating: number | null; viewedAt: Date }>;

export function ApplicationDrawer({ applicationId, onClose, onChanged }: { applicationId: string | null; onClose: () => void; onChanged: (patch: Patch) => void }) {
  const { t, f, dir } = useI18n();
  const off = dir === "rtl" ? "-100%" : "100%";
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [tab, setTab] = useState<"match" | "application" | "notes" | "activity">("match");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const load = (id: string) =>
    void openApplicationAction(id).then((d) => {
      setDetail(d);
      if (d) onChanged({ viewedAt: new Date(), status: d.status });
    });

  useEffect(() => {
    setDetail(null);
    setTab("match");
    if (applicationId) load(applicationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string } | null>, patch?: Patch) =>
    start(async () => {
      const res = await fn();
      if (res?.ok) {
        if (res.message) toast.success(res.message);
        if (patch) onChanged(patch);
        if (applicationId) load(applicationId);
      } else toast.error(res?.error ?? t("common.somethingWrong"));
    });

  // Hiring and declining notify the candidate: confirm first, then allow an undo window.
  const decide = useFinalDecision();
  const decideFinal = (kind: "hire" | "decline" | "reopen", target?: PipelineStage) => {
    if (!detail) return;
    const before = { stage: detail.stage, status: detail.status };
    const reopenTo = target ?? "FINAL";
    const after: Patch = kind === "hire" ? { stage: "HIRED", status: "HIRED" } : kind === "reopen" ? { stage: reopenTo, status: STATUS_FOR_STAGE[reopenTo] } : { status: "REJECTED" };
    const id = detail.id;
    const commit = () =>
      kind === "hire"
        ? moveApplicationAction(id, "HIRED", Date.now())
        : kind === "reopen"
          ? moveApplicationAction(id, reopenTo, Date.now(), { leaveHired: true })
          : setApplicationStatusAction(id, "REJECTED");
    const patchDetail = (p: Patch) => setDetail((d) => (d && d.id === id ? { ...d, ...p } : d));
    const decision = {
      kind,
      candidate: detail.applicant.name,
      apply: () => {
        patchDetail(after);
        onChanged(after);
      },
      revert: () => {
        patchDetail(before);
        onChanged(before);
      },
      commit,
      onCommitted: () => applicationId === id && load(id),
    };
    // Outside a pipeline (no provider) fall back to a plain confirm + immediate save.
    if (decide) decide(decision);
    else if (window.confirm(t(kind === "hire" ? "recruiter.confirmHireTitle" : kind === "reopen" ? "recruiter.confirmReopenTitle" : "recruiter.confirmDeclineTitle", { name: detail.applicant.name })))
      run(commit, after);
  };

  const match = detail?.matchSnapshot as MatchResult | null | undefined;
  const p = detail?.applicant.profile;

  return (
    <D.Root open={!!applicationId} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {applicationId && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <m.div className="fixed inset-0 z-50 bg-[oklch(0.15_0.02_278/0.35)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </D.Overlay>
            <D.Content
              asChild
              forceMount
              // Clicking the "Undo" bar of a pending hire/decline must not close the drawer.
              onInteractOutside={(e) => (e.target as Element | null)?.closest?.("[data-final-decision-bar]") && e.preventDefault()}
            >
              <m.aside
                className="fixed inset-y-0 end-0 z-50 flex w-full max-w-xl flex-col border-s border-border bg-surface shadow-float"
                initial={{ x: off }}
                animate={{ x: 0 }}
                exit={{ x: off }}
                transition={{ type: "spring", stiffness: 380, damping: 40 }}
              >
                <D.Title className="sr-only">{t("recruiter.tabApplication")}</D.Title>
                <D.Description className="sr-only">{detail?.job.title ?? ""}</D.Description>
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <span className="text-xs font-medium text-fg-muted">{detail ? detail.job.title : t("common.loading")}</span>
                  <D.Close className="rounded-full p-1.5 text-fg-subtle hover:bg-surface-2" aria-label={t("common.close")}>
                    <X className="size-4" />
                  </D.Close>
                </div>
                {!detail ? (
                  <div className="space-y-4 p-6">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar name={detail.applicant.name} src={detail.applicant.image} size="lg" />
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-xl font-semibold">{detail.applicant.name}</h2>
                          <p className="text-sm text-fg-muted">{p?.headline}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-fg-subtle">
                            {p?.city && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3" /> {f.location(p.city, p.countryCode)}
                              </span>
                            )}
                            {p && <span>{t("common.yearsExp", { years: f.years(p.yearsExperience) })}</span>}
                            {p && <span>{t(`enums.availability.${p.availability}`)}</span>}
                          </div>
                        </div>
                        <Badge tone={detail.status === "REJECTED" ? "danger" : detail.status === "OFFER" || detail.status === "HIRED" ? "mint" : "brand"}>{t(`enums.applicationStatus.${detail.status}`)}</Badge>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/recruiter/candidates/${detail.applicant.username}?job=${detail.job.id}`} className={buttonClasses({ size: "sm", variant: "outline" })}>
                          <ExternalLink /> {t("recruiter.fullProfile")}
                        </Link>
                        <Link href={`/messages?to=${detail.applicant.id}`} className={buttonClasses({ size: "sm", variant: "outline" })}>
                          <MessageSquare /> {t("common.message")}
                        </Link>
                        <ScheduleInterviewButton applicationId={detail.id} candidateName={detail.applicant.name} onDone={() => load(detail.id)} />
                      </div>

                      <div className="mt-5 rounded-2xl border border-border bg-surface-2/50 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t("recruiter.stage")}</span>
                          <span className="inline-flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => run(() => rateApplicationAction(detail.id, detail.rating === n ? 0 : n), { rating: detail.rating === n ? null : n })}
                                aria-label={`${n}/5`}
                              >
                                <Star className={cn("size-4 transition", detail.rating && n <= detail.rating ? "fill-ember text-ember" : "text-border-strong hover:text-ember")} />
                              </button>
                            ))}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {PIPELINE_STAGES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                s === "HIRED" && detail.stage !== "HIRED"
                                  ? decideFinal("hire")
                                  : detail.status === "HIRED" && s !== "HIRED"
                                    ? decideFinal("reopen", s)
                                    : run(() => moveApplicationAction(detail.id, s, Date.now()), { stage: s, status: detail.status === "REJECTED" ? "VIEWED" : detail.status })
                              }
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                                detail.stage === s && detail.status !== "REJECTED" ? "border-brand bg-brand text-brand-fg" : "border-border hover:border-brand/50",
                              )}
                            >
                              {t(`enums.pipelineStage.${s}`)}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {detail.status !== "OFFER" && detail.status !== "HIRED" && (
                            <Button size="sm" variant="mint" loading={pending} onClick={() => run(() => setApplicationStatusAction(detail.id, "OFFER"), { status: "OFFER", stage: "FINAL" })}>
                              <Gift /> {t("recruiter.extendOffer")}
                            </Button>
                          )}
                          {detail.status !== "REJECTED" && detail.status !== "HIRED" && (
                            <Button size="sm" variant="ghost" disabled={pending} onClick={() => decideFinal("decline")}>
                              <XCircle /> {t("recruiter.decline")}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border px-6 pt-4">
                      <Segmented
                        layoutId="drawer-tabs"
                        value={tab}
                        onChange={setTab}
                        options={[
                          { value: "match", label: t("recruiter.tabMatch") },
                          { value: "application", label: t("recruiter.tabApplication") },
                          { value: "notes", label: t("recruiter.tabNotes", { n: detail.notes.length }) },
                          { value: "activity", label: t("recruiter.tabActivity") },
                        ]}
                      />
                    </div>
                    <div className="p-6">
                      {tab === "match" &&
                        (match ? (
                          <>
                            <MatchBreakdown match={match} perspective="recruiter" />
                            {p && p.skills.length > 0 && (
                              <div className="mt-5">
                                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t("recruiter.candidateSkills")}</div>
                                <ul className="grid grid-cols-2 gap-1.5">
                                  {p.skills.map((s) => (
                                    <li key={s.skill.name} className="flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
                                      {s.skill.name} <LevelBars level={s.level} />
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-fg-muted">—</p>
                        ))}
                      {tab === "application" && (
                        <div className="space-y-5">
                          <div>
                            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t("recruiter.noteFromCandidate")}</div>
                            <p className="whitespace-pre-line text-sm text-fg-muted">{detail.coverLetter || t("recruiter.noNote")}</p>
                          </div>
                          {detail.resumeUrl && (
                            <a href={detail.resumeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:border-brand/40">
                              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-soft-fg">
                                <FileText className="size-5" />
                              </span>
                              <span className="text-sm font-medium">{t("recruiter.viewCv")}</span>
                            </a>
                          )}
                          {p && p.experiences.length > 0 && (
                            <div>
                              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t("recruiter.recentExp")}</div>
                              <ul className="space-y-2">
                                {p.experiences.map((e, i) => (
                                  <li key={i} className="text-sm">
                                    <span className="font-medium">{e.title}</span> · {e.companyName}
                                    <div className="text-xs text-fg-subtle">
                                      {f.date(e.startDate)} – {e.isCurrent ? t("profile.present") : f.date(e.endDate)}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {detail.interviews.length > 0 && (
                            <div>
                              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">{t("interviews.title")}</div>
                              <ul className="space-y-1.5 text-sm">
                                {detail.interviews.map((i) => (
                                  <li key={i.id} className="flex justify-between">
                                    <span>
                                      {t(`enums.interviewType.${i.type}`)} · <LocalTime date={i.startsAt} />
                                    </span>
                                    <span className="text-xs text-fg-muted">{t(INTERVIEW_STATE_KEY[i.status === "SCHEDULED" ? i.candidateResponse : (i.status as "COMPLETED" | "CANCELLED")])}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p className="text-xs text-fg-subtle">{t("recruiter.appliedAgo", { when: f.timeAgo(detail.createdAt) })}</p>
                        </div>
                      )}
                      {tab === "notes" && (
                        <div>
                          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder={t("recruiter.privateNote")} className="min-h-20" />
                          <div className="mt-2 flex justify-end">
                            <Button
                              size="sm"
                              loading={pending}
                              disabled={!note.trim()}
                              onClick={() =>
                                run(async () => {
                                  const r = await addNoteAction(detail.id, note);
                                  if (r?.ok) setNote("");
                                  return r;
                                })
                              }
                            >
                              {t("recruiter.addNote")}
                            </Button>
                          </div>
                          <ul className="mt-4 space-y-3">
                            {detail.notes.map((n) => (
                              <li key={n.id} className="flex gap-2.5">
                                <Avatar name={n.author.name} src={n.author.image} size="sm" />
                                <div className="flex-1 rounded-2xl bg-surface-2 px-3.5 py-2.5">
                                  <div className="text-xs font-semibold">
                                    {n.author.name} <span className="font-normal text-fg-subtle">· {f.timeAgo(n.createdAt)}</span>
                                  </div>
                                  <p className="mt-0.5 whitespace-pre-line text-sm">{n.body}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {tab === "activity" && (
                        <ol className="space-y-3 border-s border-border ps-5">
                          {detail.events.map((e) => (
                            <li key={e.id} className="relative text-sm">
                              <span className="absolute -start-[25px] top-1.5 size-2 rounded-full bg-brand" />
                              <span className="font-medium">{t(`enums.applicationStatus.${e.toStatus}`)}</span>
                              {e.toStage && <span className="text-fg-muted"> · {t(`enums.pipelineStage.${e.toStage}`)}</span>}
                              <div className="text-xs text-fg-subtle">
                                {e.actor?.name ?? t("recruiter.system")} · {f.timeAgo(e.createdAt)}
                              </div>
                              {e.note && <p className="mt-1 text-xs text-fg-muted">“{e.note}”</p>}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}
              </m.aside>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
