import type { Format } from "@/i18n/format";
import type { T } from "@/i18n/translate";
import type { CriterionResult, Reason } from "@/lib/matching/engine";

/** Renders an engine reason code in the active language. */
export function describeReason(r: Reason, t: T, f: Format) {
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(r.vars ?? {})) {
    if (k === "mode") vars[k] = t(`enums.workMode.${v}`);
    else if (k === "modes") vars[k] = f.list(String(v).split(",").filter(Boolean).map((m) => t(`enums.workMode.${m}`)));
    else if (k === "type") vars[k] = t(`enums.employmentType.${v}`);
    else if (k === "level") vars[k] = t(`enums.educationLevel.${v}`);
    else if (k === "years") vars[k] = f.years(Number(v));
    else if (k === "place" && /^[A-Z]{2}$/.test(String(v))) vars[k] = f.country(String(v));
    else vars[k] = v;
  }
  return t(`match.r.${r.key}`, vars);
}

/** Full explanation for a criterion. Falls back to stored English for older snapshots. */
export function describeCriterion(c: CriterionResult, t: T, f: Format) {
  if (!c.reasons?.length) return c.detail;
  return c.reasons.map((r) => describeReason(r, t, f)).join(" · ");
}

export function describeHighlight(h: Reason | string, t: T, f: Format) {
  return typeof h === "string" ? h : describeReason(h, t, f);
}
