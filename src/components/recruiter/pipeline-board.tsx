"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Eye, Star, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { MatchPill } from "@/components/match/match-ring";
import { ApplicationDrawer } from "@/components/recruiter/application-drawer";
import { FinalDecisionProvider, useFinalDecision } from "@/components/recruiter/final-decision";
import { moveApplicationAction, setApplicationStatusAction } from "@/server/actions/recruiter";
import { PIPELINE_STAGES, type ApplicationStatus, type PipelineStage } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import type { T } from "@/i18n/translate";

export type BoardCard = {
  id: string;
  status: ApplicationStatus;
  stage: PipelineStage;
  stagePosition: number;
  matchScore: number;
  rating: number | null;
  createdAt: Date;
  viewedAt: Date | null;
  applicant: { id: string; name: string; image: string | null; username: string | null; profile: { headline: string | null } | null };
  interviews: number;
};

type Column = PipelineStage | "REJECTED";
const COLUMNS: Column[] = [...PIPELINE_STAGES, "REJECTED"];
const columnLabel = (t: T, c: Column) => (c === "REJECTED" ? t("recruiter.notSelected") : t(`enums.pipelineStage.${c}`));
const COLUMN_TONE: Record<Column, string> = {
  APPLIED: "bg-aurora",
  SCREENING: "bg-brand",
  INTERVIEW: "bg-ember",
  FINAL: "bg-[oklch(0.65_0.2_330)]",
  HIRED: "bg-mint",
  REJECTED: "bg-fg-subtle",
};

const columnOf = (c: BoardCard): Column => (c.status === "REJECTED" ? "REJECTED" : c.stage);

function CardBody({ c, dragging }: { c: BoardCard; dragging?: boolean }) {
  const { t, f } = useI18n();
  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-3 shadow-soft transition-shadow", dragging && "rotate-2 shadow-float ring-2 ring-brand/40")}>
      <div className="flex items-start gap-2.5">
        <Avatar name={c.applicant.name} src={c.applicant.image} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{c.applicant.name}</div>
          <div className="truncate text-[11px] text-fg-muted">{c.applicant.profile?.headline}</div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <MatchPill score={c.matchScore} />
        {c.status === "OFFER" && <Badge tone="mint" size="xs">{t("recruiter.offer")}</Badge>}
        {c.interviews > 0 && (
          <Badge size="xs">
            <CalendarClock /> {c.interviews}
          </Badge>
        )}
        {!c.viewedAt && (
          <Badge tone="brand" size="xs">
            {t("common.new")}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-fg-subtle">
        <span className="inline-flex gap-0.5" aria-label={c.rating ? `${c.rating}/5` : "—"}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={cn("size-3", c.rating && n <= c.rating ? "fill-ember text-ember" : "text-border-strong")} />
          ))}
        </span>
        <span className="inline-flex items-center gap-1" suppressHydrationWarning>
          {c.viewedAt && <Eye className="size-3" />}
          {f.shortTimeAgo(c.createdAt)}
        </span>
      </div>
    </div>
  );
}

function SortableCard({ c, onOpen }: { c: BoardCard; onOpen: () => void }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id, data: { column: columnOf(c) } });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter") onOpen();
      }}
      aria-label={`${c.applicant.name}, ${t("match.pct", { n: c.matchScore })}`}
    >
      <CardBody c={c} />
    </li>
  );
}

function ColumnView({ id, cards, onOpen }: { id: Column; cards: BoardCard[]; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}` });
  return (
    <section className={cn("flex w-[248px] shrink-0 snap-start flex-col rounded-3xl bg-surface-2/70 p-2.5 transition-colors", isOver && "bg-brand-soft/60 ring-2 ring-brand/30", id === "REJECTED" && "opacity-80")}>
      <header className="flex items-center justify-between px-2 pb-2.5 pt-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn("size-2 rounded-full", COLUMN_TONE[id])} />
          {columnLabel(t, id)}
        </h3>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-fg-muted">{cards.length}</span>
      </header>
      <SortableContext id={`col:${id}`} items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-32 flex-1 flex-col gap-2">
          {cards.map((c) => (
            <SortableCard key={c.id} c={c} onOpen={() => onOpen(c.id)} />
          ))}
          {cards.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border-strong p-4 text-center text-xs text-fg-subtle">
              {id === "REJECTED" ? (
                <span className="inline-flex items-center gap-1">
                  <XCircle className="size-3.5" /> {t("recruiter.dropDecline")}
                </span>
              ) : (
                t("recruiter.dropHere")
              )}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

export function PipelineBoard(props: { initial: BoardCard[]; openId: string | null }) {
  return (
    <FinalDecisionProvider>
      <Board {...props} />
    </FinalDecisionProvider>
  );
}

function Board({ initial, openId }: { initial: BoardCard[]; openId: string | null }) {
  const { t } = useI18n();
  const decide = useFinalDecision();
  const [cards, setCards] = useState<BoardCard[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<string | null>(openId);
  const [, start] = useTransition();
  const snapshot = useRef<BoardCard[]>(initial);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useEffect(() => setCards(initial), [initial]);

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c, [] as BoardCard[]])) as Record<Column, BoardCard[]>;
    for (const c of [...cards].sort((a, b) => a.stagePosition - b.stagePosition)) map[columnOf(c)].push(c);
    return map;
  }, [cards]);

  const findColumn = (id: string): Column | null => {
    if (id.startsWith("col:")) return id.slice(4) as Column;
    const c = cards.find((x) => x.id === id);
    return c ? columnOf(c) : null;
  };

  const onDragStart = (e: DragStartEvent) => {
    snapshot.current = cards;
    setActiveId(String(e.active.id));
  };
  const revert = () => setCards(snapshot.current);

  // Move the card into the hovered column immediately for live feedback.
  const onDragOver = (e: DragOverEvent) => {
    if (!e.over) return;
    const from = findColumn(String(e.active.id));
    const to = findColumn(String(e.over.id));
    if (!from || !to || from === to) return;
    setCards((list) =>
      list.map((c) =>
        c.id === e.active.id ? { ...c, stage: to === "REJECTED" ? c.stage : to, status: to === "REJECTED" ? "REJECTED" : c.status === "REJECTED" ? "VIEWED" : c.status } : c,
      ),
    );
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const original = snapshot.current.find((c) => c.id === id)!;
    if (!e.over) return revert();
    const to = findColumn(String(e.over.id));
    if (!to) return;

    // Compute a fractional position between the new neighbours (single write).
    const column = byColumn[to].filter((c) => c.id !== id);
    const overIndex = column.findIndex((c) => c.id === e.over!.id);
    const index = overIndex === -1 ? column.length : overIndex;
    const before = column[index - 1]?.stagePosition;
    const after = column[index]?.stagePosition;
    const position = before != null && after != null ? (before + after) / 2 : before != null ? before + 1024 : after != null ? after - 1024 : Date.now();

    setCards((list) => list.map((c) => (c.id === id ? { ...c, stagePosition: position } : c)));
    const prevColumn = columnOf(original);

    // Hiring, declining and leaving Hired notify the candidate: confirm, then allow an undo window.
    const leavingHired = original.status === "HIRED" && to !== "HIRED";
    if (prevColumn !== to && (to === "HIRED" || to === "REJECTED" || leavingHired)) {
      if (to === "REJECTED" && original.status === "HIRED") {
        toast.error(t("msg.cannotDeclineHired"));
        return revert();
      }
      const before = snapshot.current;
      if (leavingHired) {
        decide?.({
          kind: "reopen",
          candidate: original.applicant.name,
          apply: () => {},
          revert: () => setCards(before),
          commit: () => moveApplicationAction(id, to, position, { leaveHired: true }),
        });
        return;
      }
      decide?.({
        kind: to === "HIRED" ? "hire" : "decline",
        candidate: original.applicant.name,
        apply: () => {},
        revert: () => setCards(before),
        commit: () => (to === "REJECTED" ? setApplicationStatusAction(id, "REJECTED") : moveApplicationAction(id, to, position)),
      });
      return;
    }

    start(async () => {
      const res =
        to === "REJECTED"
          ? prevColumn === "REJECTED"
            ? { ok: true }
            : await setApplicationStatusAction(id, "REJECTED")
          : await moveApplicationAction(id, to, position);
      if (!res?.ok) {
        toast.error(res && "error" in res ? (res.error ?? t("common.somethingWrong")) : t("common.somethingWrong"));
        revert();
      } else if (prevColumn !== to) {
        toast.success(to === "REJECTED" ? t("recruiter.declinedToast") : t("recruiter.movedTo", { stage: columnLabel(t, to) }));
      }
    });
  };

  const active = activeId ? cards.find((c) => c.id === activeId) : null;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={revert}>
        {/* Fixed-width columns scroll sideways; the scrollbar stays visible so "Not selected" is discoverable. */}
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:thin] sm:mx-0 sm:px-0">
          {COLUMNS.map((col) => (
            <ColumnView key={col} id={col} cards={byColumn[col]} onOpen={setDrawer} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.16,1,0.3,1)" }}>{active ? <CardBody c={active} dragging /> : null}</DragOverlay>
      </DndContext>
      <ApplicationDrawer
        applicationId={drawer}
        onClose={() => setDrawer(null)}
        onChanged={(patch) => drawer && setCards((list) => list.map((c) => (c.id === drawer ? { ...c, ...patch } : c)))}
      />
    </>
  );
}
