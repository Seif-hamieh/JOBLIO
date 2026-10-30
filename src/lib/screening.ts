import { z } from "zod";

// Screening questions: the company asks up to 5 questions on a job, and everyone who applies answers them. Shared by
// the job form (website and app), the apply forms (to check answers before sending) and the server (which checks
// them again and stores a copy with the application).

export const SCREENING_TYPES = ["TEXT", "YES_NO", "NUMBER", "MULTIPLE_CHOICE"] as const;
export type ScreeningType = (typeof SCREENING_TYPES)[number];
export const MAX_SCREENING_QUESTIONS = 5;
export const MAX_TEXT_ANSWER = 1000;

/** One question as the job form sends it. */
export const screeningQuestionSchema = z
  .object({
    questionText: z.string().trim().min(3, "@v.questionText").max(300),
    type: z.enum(SCREENING_TYPES),
    options: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
    isRequired: z.boolean().default(true),
  })
  .transform((q) => ({ ...q, options: q.type === "MULTIPLE_CHOICE" ? [...new Set(q.options)] : [] }))
  .refine((q) => q.type !== "MULTIPLE_CHOICE" || q.options.length >= 2, { message: "@v.questionOptions", path: ["options"] });

export const screeningQuestionsSchema = z.array(screeningQuestionSchema).max(MAX_SCREENING_QUESTIONS, "@v.questionsMax");

export type ScreeningQuestion = { id: string; questionText: string; type: ScreeningType; options: string[]; isRequired: boolean };

/** What an application stores for each question (the wording is copied, so editing the job later changes nothing). */
export type ScreeningAnswer = { questionId: string; question: string; type: ScreeningType; answer: string | number | null };

/**
 * Checks the answers (keyed by question id) against the job's questions. YES_NO answers are "YES"/"NO", NUMBER a
 * number, MULTIPLE_CHOICE one of the options, TEXT up to 1,000 characters. Returns the answers to store, or the first
 * problem as a message key with the question it is about.
 */
export function checkScreeningAnswers(
  questions: ScreeningQuestion[],
  given: Record<string, unknown> | null | undefined,
): { ok: true; answers: ScreeningAnswer[] } | { ok: false; error: string; questionId: string } {
  const answers: ScreeningAnswer[] = [];
  for (const q of questions) {
    const raw = given?.[q.id];
    const text = raw == null ? "" : String(raw).trim();
    if (!text) {
      if (q.isRequired) return { ok: false, error: "@msg.screeningRequired", questionId: q.id };
      answers.push({ questionId: q.id, question: q.questionText, type: q.type, answer: null });
      continue;
    }
    let answer: string | number;
    if (q.type === "YES_NO") {
      const yn = text.toUpperCase();
      if (yn !== "YES" && yn !== "NO") return { ok: false, error: "@msg.screeningInvalid", questionId: q.id };
      answer = yn;
    } else if (q.type === "NUMBER") {
      const n = Number(text.replace(",", "."));
      if (!Number.isFinite(n) || Math.abs(n) > 1e9) return { ok: false, error: "@msg.screeningNumber", questionId: q.id };
      answer = n;
    } else if (q.type === "MULTIPLE_CHOICE") {
      if (!q.options.includes(text)) return { ok: false, error: "@msg.screeningInvalid", questionId: q.id };
      answer = text;
    } else {
      if (text.length > MAX_TEXT_ANSWER) return { ok: false, error: "@msg.screeningTooLong", questionId: q.id };
      answer = text;
    }
    answers.push({ questionId: q.id, question: q.questionText, type: q.type, answer });
  }
  return { ok: true, answers };
}

/** A phone number as members type it: digits with an optional leading +, spaces, dashes and brackets. */
export const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .regex(/^\+?[0-9][0-9 ()-]{5,30}$/, "@v.phone")
  .or(z.literal("").transform(() => null))
  .nullable()
  .optional();
