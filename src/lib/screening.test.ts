import { describe, expect, it } from "vitest";
import { checkScreeningAnswers, phoneSchema, screeningQuestionsSchema, type ScreeningQuestion } from "./screening";

const qs: ScreeningQuestion[] = [
  { id: "q1", questionText: "Do you live in Beirut?", type: "YES_NO", options: [], isRequired: true },
  { id: "q2", questionText: "Years of React?", type: "NUMBER", options: [], isRequired: true },
  { id: "q3", questionText: "Start date?", type: "MULTIPLE_CHOICE", options: ["Now", "In a month"], isRequired: true },
  { id: "q4", questionText: "Anything else?", type: "TEXT", options: [], isRequired: false },
];

describe("checkScreeningAnswers", () => {
  it("accepts valid answers and keeps a copy of each question", () => {
    const r = checkScreeningAnswers(qs, { q1: "yes", q2: "3,5", q3: "Now" });
    expect(r).toEqual({
      ok: true,
      answers: [
        { questionId: "q1", question: "Do you live in Beirut?", type: "YES_NO", answer: "YES" },
        { questionId: "q2", question: "Years of React?", type: "NUMBER", answer: 3.5 },
        { questionId: "q3", question: "Start date?", type: "MULTIPLE_CHOICE", answer: "Now" },
        { questionId: "q4", question: "Anything else?", type: "TEXT", answer: null },
      ],
    });
  });

  it("refuses a missing required answer, a wrong choice and a non-number", () => {
    expect(checkScreeningAnswers(qs, { q2: "1", q3: "Now" })).toMatchObject({ ok: false, error: "@msg.screeningRequired", questionId: "q1" });
    expect(checkScreeningAnswers(qs, { q1: "maybe", q2: "1", q3: "Now" })).toMatchObject({ ok: false, error: "@msg.screeningInvalid" });
    expect(checkScreeningAnswers(qs, { q1: "NO", q2: "lots", q3: "Now" })).toMatchObject({ ok: false, error: "@msg.screeningNumber" });
    expect(checkScreeningAnswers(qs, { q1: "NO", q2: "1", q3: "Tomorrow" })).toMatchObject({ ok: false, error: "@msg.screeningInvalid", questionId: "q3" });
    expect(checkScreeningAnswers(qs, { q1: "NO", q2: "1", q3: "Now", q4: "x".repeat(1001) })).toMatchObject({ ok: false, error: "@msg.screeningTooLong" });
  });

  it("ignores answers to questions the job doesn't have, and works for jobs without questions", () => {
    expect(checkScreeningAnswers([], { stray: "x" })).toEqual({ ok: true, answers: [] });
    expect(checkScreeningAnswers([], undefined)).toEqual({ ok: true, answers: [] });
  });
});

describe("screening question form", () => {
  it("allows at most 5 questions and needs 2+ choices for multiple choice", () => {
    const q = { questionText: "Question?", type: "TEXT" as const };
    expect(screeningQuestionsSchema.safeParse(Array(5).fill(q)).success).toBe(true);
    expect(screeningQuestionsSchema.safeParse(Array(6).fill(q)).success).toBe(false);
    expect(screeningQuestionsSchema.safeParse([{ questionText: "Pick one", type: "MULTIPLE_CHOICE", options: ["A"] }]).success).toBe(false);
    // Options are dropped for other types, and duplicates removed.
    const parsed = screeningQuestionsSchema.parse([{ questionText: "Ok?", type: "YES_NO", options: ["x"] }, { questionText: "Pick", type: "MULTIPLE_CHOICE", options: ["A", "A", "B"] }]);
    expect(parsed.map((p) => p.options)).toEqual([[], ["A", "B"]]);
  });
});

describe("phone numbers", () => {
  it("takes local and international formats, and blank as none", () => {
    for (const ok of ["+961 70 123 456", "70123456", "+1 (415) 555-0100"]) expect(phoneSchema.parse(ok)).toBe(ok);
    expect(phoneSchema.parse("")).toBeNull();
    expect(phoneSchema.parse(undefined)).toBeUndefined();
    for (const bad of ["call me", "123", "+961<script>"]) expect(phoneSchema.safeParse(bad).success).toBe(false);
  });
});
