"use client";

import { useI18n } from "@/i18n/client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, ThumbsUp, X } from "lucide-react";
import { SkillSearch } from "@/components/skills/skill-search";
import { LevelPicker } from "@/components/skills/level-picker";
import { toast } from "@/components/ui/toast";
import { addSkillAction, removeSkillAction, reorderSkillsAction, updateSkillAction } from "@/server/actions/profile";
import type { SkillLevel } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type ManagedSkill = { id: string; skillId: string; name: string; category: string; level: SkillLevel; years: number | null; isTop: boolean; endorsementCount: number };

function SortableSkill({ s, onChange, onRemove }: { s: ManagedSkill; onChange: (patch: Partial<ManagedSkill>) => void; onRemove: () => void }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border bg-surface px-3 py-2.5 sm:flex-nowrap",
        isDragging ? "z-10 border-brand shadow-float" : "border-border",
        s.isTop && "border-brand/30 bg-brand-soft/30",
      )}
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none rounded-lg p-1 text-fg-subtle hover:bg-surface-2 active:cursor-grabbing" aria-label={t("skills.reorder", { name: s.name })}>
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{s.name}</div>
        <div className="text-[11px] text-fg-subtle">{s.category}</div>
      </div>
      <LevelPicker value={s.level} onChange={(level) => onChange({ level })} size="sm" />
      <label className="flex items-center gap-1 text-xs text-fg-muted">
        <input
          type="number"
          min={0}
          max={60}
          step={0.5}
          defaultValue={s.years ?? ""}
          onBlur={(e) => {
            const years = e.target.value === "" ? null : Number(e.target.value);
            if (years !== s.years) onChange({ years });
          }}
          className="h-8 w-14 rounded-lg border border-border bg-surface px-2 text-sm"
          aria-label={`${s.name} · ${t("skills.yrs")}`}
        />
        yrs
      </label>
      {s.endorsementCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs text-fg-muted" title={t("skills.endorsements", { n: s.endorsementCount })}>
          <ThumbsUp className="size-3" /> {s.endorsementCount}
        </span>
      )}
      <button
        type="button"
        onClick={() => onChange({ isTop: !s.isTop })}
        className={cn("rounded-lg p-1.5 transition", s.isTop ? "text-ember" : "text-fg-subtle hover:text-ember")}
        aria-pressed={s.isTop}
        aria-label={s.isTop ? t("skills.unmarkTop") : t("skills.markTop")}
        title={t("skills.topSkill")}
      >
        <Star className={cn("size-4", s.isTop && "fill-current")} />
      </button>
      <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-fg-subtle hover:bg-danger-soft hover:text-danger-fg" aria-label={`${t("common.remove")} ${s.name}`}>
        <X className="size-4" />
      </button>
    </li>
  );
}

export function SkillManager({ initial }: { initial: ManagedSkill[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [skills, setSkills] = useState(initial);
  const [, start] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const persist = (fn: () => Promise<{ ok: boolean; error?: string } | null>, rollback: ManagedSkill[]) =>
    start(async () => {
      const res = await fn();
      if (!res?.ok) {
        setSkills(rollback);
        toast.error(res?.error ?? t("common.somethingWrong"));
      } else router.refresh();
    });

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const prev = skills;
    const next = arrayMove(skills, skills.findIndex((s) => s.id === e.active.id), skills.findIndex((s) => s.id === e.over!.id));
    setSkills(next);
    persist(() => reorderSkillsAction(next.map((s) => s.id)), prev);
  };

  return (
    <div>
      <SkillSearch
        exclude={skills.map((s) => s.skillId)}
        onSelect={(opt) =>
          start(async () => {
            const res = await addSkillAction({ skillId: opt.id, level: "INTERMEDIATE" });
            if (res?.ok && res.data) {
              setSkills((list) => [...list, { id: res.data!.userSkillId, skillId: opt.id, name: opt.name, category: opt.category, level: "INTERMEDIATE", years: null, isTop: false, endorsementCount: 0 }]);
              toast.success(t("skills.added", { name: opt.name }));
              router.refresh();
            } else toast.error(res && !res.ok ? res.error : t("common.somethingWrong"));
          })
        }
      />
      <p className="mt-2 text-xs text-fg-subtle">{t("skills.manageHint")}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={skills.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="mt-4 space-y-2">
            {skills.map((s) => (
              <SortableSkill
                key={s.id}
                s={s}
                onChange={(patch) => {
                  const prev = skills;
                  setSkills((list) => list.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
                  persist(() => updateSkillAction(s.id, patch), prev);
                }}
                onRemove={() => {
                  const prev = skills;
                  setSkills((list) => list.filter((x) => x.id !== s.id));
                  persist(() => removeSkillAction(s.id), prev);
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
