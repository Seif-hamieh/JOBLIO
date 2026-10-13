import { describe, expect, it } from "vitest";
import { jobSchema, startOfTodayUtc } from "./job";

const base = {
  title: "Designer",
  description: "We are looking for a product designer to join our team and shape our product.",
  responsibilities: [],
  requirements: [],
  benefits: [],
  workMode: "REMOTE",
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  minYearsExperience: 2,
  educationLevel: "NONE",
  city: "",
  countryCode: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "USD",
  salaryPeriod: "YEAR",
  industryId: null,
  skills: [{ skillId: "s1", required: true, minLevel: "INTERMEDIATE" }],
  languages: [],
};
const day = (offset: number) => new Date(startOfTodayUtc() + offset * 86_400_000).toISOString().slice(0, 10);

describe("job closing date", () => {
  it("rejects a date in the past", () => {
    const r = jobSchema.safeParse({ ...base, closesAt: day(-1) });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContain("@v.closesPast");
  });
  it("accepts today, a later date, or no date", () => {
    expect(jobSchema.safeParse({ ...base, closesAt: day(0) }).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, closesAt: day(30) }).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, closesAt: "" }).success).toBe(true);
  });
});
