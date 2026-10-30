"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { MAX_SCREENING_QUESTIONS, SCREENING_TYPES, type ScreeningType } from "@/lib/screening";
import type { ScreeningDraft } from "@/lib/job-form";

/**
 * The job form's screening questions: up to 5, each with its type (text, yes/no, number, a choice), its choices
 * for multiple choice, and whether an answer is required. Applicants answer them in the apply form.
 */
export function ScreeningEditor({ value, onChange, error }: { value: ScreeningDraft[]; onChange: (v: ScreeningDraft[]) => void; error?: string[] }) {
  const { t } = useI18n();
  const update = (i: number, patch: Partial<ScreeningDraft>) => onChange(value.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, by: number) => {
    const next = [...value];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.map((q, i) => (
        <div key={q.key} className="space-y-3 rounded-2xl border border-border bg-surface-2/40 p-4">
          <div className="flex items-start gap-2">
            <span className="mt-2.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-soft-fg">{i + 1}</span>
            <Input
              value={q.questionText}
              onChange={(e) => update(i, { questionText: e.target.value })}
              maxLength={300}
              placeholder={t("screening.questionPh")}
              aria-label={t("screening.question", { n: i + 1 })}
              className="flex-1"
            />
            <div className="flex shrink-0 items-center">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-2 text-fg-muted hover:bg-surface-2 disabled:opacity-30" aria-label={t("screening.moveUp")}>
                <ArrowUp className="size-4" />
              </button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="rounded-lg p-2 text-fg-muted hover:bg-surface-2 disabled:opacity-30" aria-label={t("screening.moveDown")}>
                <ArrowDown className="size-4" />
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-lg p-2 text-danger-fg hover:bg-danger-soft" aria-label={t("common.remove")}>
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 ps-8">
            <Select value={q.type} onChange={(e) => update(i, { type: e.target.value as ScreeningType })} aria-label={t("screening.type")} className="min-w-44">
              {SCREENING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`screening.types.${type}`)}
                </option>
              ))}
            </Select>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={q.isRequired} onChange={(e) => update(i, { isRequired: e.target.checked })} className="size-4 accent-[var(--brand)]" />
              {t("screening.required")}
            </label>
          </div>
          {q.type === "MULTIPLE_CHOICE" && <Choices value={q.options} onChange={(options) => update(i, { options })} />}
        </div>
      ))}

      {error?.length ? <p className="text-sm text-danger-fg">{error[0]}</p> : null}

      {value.length < MAX_SCREENING_QUESTIONS ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...value, { key: crypto.randomUUID(), questionText: "", type: "YES_NO", options: [], isRequired: true }])}
        >
          <Plus /> {t("screening.add")}
        </Button>
      ) : (
        <p className="text-xs text-fg-subtle">{t("screening.max")}</p>
      )}
    </div>
  );
}

/** The choices of a multiple-choice question (2 to 10). */
function Choices({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const add = () => {
    const c = draft.trim();
    if (!c || value.includes(c) || value.length >= 10) return;
    onChange([...value, c]);
    setDraft("");
  };
  return (
    <div className="space-y-2 ps-8">
      <div className="flex flex-wrap gap-1.5">
        {value.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm">
            {c}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== c))} aria-label={t("common.remove")}>
              <X className="size-3.5 text-fg-subtle" />
            </button>
          </span>
        ))}
      </div>
      {value.length < 10 && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            maxLength={100}
            placeholder={t("screening.choicePh")}
            className="max-w-xs"
          />
          <Button type="button" variant="outline" onClick={add} aria-label={t("screening.addChoice")}>
            <Plus />
          </Button>
        </div>
      )}
      {value.length < 2 && <p className="text-xs text-fg-subtle">{t("screening.choicesHint")}</p>}
    </div>
  );
}
