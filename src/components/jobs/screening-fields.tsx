"use client";

import { Input, Select, Textarea } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { MAX_TEXT_ANSWER, type ScreeningAnswer, type ScreeningQuestion } from "@/lib/screening";

/**
 * The job's screening questions inside the apply form. Each answer is a form field named "answer.<question id>",
 * which the apply action reads; `invalid` marks the question the last check stopped at.
 */
export function ScreeningFields({ questions, invalid }: { questions: ScreeningQuestion[]; invalid?: string | null }) {
  const { t } = useI18n();
  if (!questions.length) return null;
  return (
    <fieldset className="space-y-4">
      <legend className="text-[13px] font-medium">{t("screening.fromCompany")}</legend>
      {questions.map((q, i) => {
        const name = `answer.${q.id}`;
        const id = `sq-${q.id}`;
        const bad = invalid === q.id;
        return (
          <div key={q.id} className={cn("rounded-2xl border p-3.5", bad ? "border-danger bg-danger-soft/40" : "border-border")}>
            <label htmlFor={id} className="block text-sm font-medium" dir="auto">
              {i + 1}. {q.questionText}
              {q.isRequired ? <span className="text-danger-fg"> *</span> : <span className="font-normal text-fg-subtle"> ({t("common.optional")})</span>}
            </label>
            <div className="mt-2">
              {q.type === "YES_NO" ? (
                <div className="flex gap-2" role="radiogroup" id={id}>
                  {(["YES", "NO"] as const).map((v) => (
                    <label key={v} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-soft-fg">
                      <input type="radio" name={name} value={v} required={q.isRequired} className="sr-only" />
                      {t(v === "YES" ? "common.yes" : "common.no")}
                    </label>
                  ))}
                </div>
              ) : q.type === "NUMBER" ? (
                <Input id={id} name={name} type="number" inputMode="decimal" step="any" required={q.isRequired} className="max-w-40" />
              ) : q.type === "MULTIPLE_CHOICE" ? (
                <Select id={id} name={name} required={q.isRequired} defaultValue="">
                  <option value="" disabled={q.isRequired}>
                    {t("common.select")}
                  </option>
                  {q.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Textarea id={id} name={name} required={q.isRequired} maxLength={MAX_TEXT_ANSWER} className="min-h-20" />
              )}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

/** The applicant's answers, for the recruiter (the question as it was asked, then the answer). */
export function ScreeningAnswers({ answers }: { answers: ScreeningAnswer[] }) {
  const { t } = useI18n();
  if (!answers.length) return null;
  return (
    <dl className="space-y-3">
      {answers.map((a) => (
        <div key={a.questionId} className="rounded-2xl border border-border p-3.5">
          <dt className="text-xs text-fg-muted" dir="auto">
            {a.question}
          </dt>
          <dd className="mt-1 whitespace-pre-line text-sm font-medium" dir="auto">
            {a.answer == null ? (
              <span className="text-fg-subtle">{t("screening.noAnswer")}</span>
            ) : a.type === "YES_NO" ? (
              <span className={a.answer === "YES" ? "text-mint-fg" : "text-danger-fg"}>{t(a.answer === "YES" ? "common.yes" : "common.no")}</span>
            ) : (
              String(a.answer)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
