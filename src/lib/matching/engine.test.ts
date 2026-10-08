import { describe, expect, it } from "vitest";
import { MATCH_WEIGHTS, computeMatch, skillCredit, type CandidateFacts, type JobFacts } from "./engine";

const candidate = (over: Partial<CandidateFacts> = {}): CandidateFacts => ({
  skills: [
    { skillId: "js", name: "JavaScript", level: "ADVANCED" },
    { skillId: "react", name: "React", level: "ADVANCED" },
    { skillId: "ts", name: "TypeScript", level: "INTERMEDIATE" },
  ],
  yearsExperience: 3,
  educationLevel: "BACHELOR",
  city: "Dubai",
  countryCode: "AE",
  preferredCities: [],
  openToRelocate: false,
  preferredWorkModes: ["REMOTE", "HYBRID"],
  preferredEmploymentTypes: ["FULL_TIME"],
  desiredSalaryMin: 60000,
  salaryCurrency: "USD",
  salaryPeriod: "YEAR",
  languages: [{ code: "en", proficiency: "FLUENT" }],
  preferredIndustryIds: ["tech"],
  availability: "TWO_WEEKS",
  ...over,
});

const job = (over: Partial<JobFacts> = {}): JobFacts => ({
  skills: [
    { skillId: "js", name: "JavaScript", required: true, minLevel: "INTERMEDIATE" },
    { skillId: "react", name: "React", required: true, minLevel: "INTERMEDIATE" },
    { skillId: "ts", name: "TypeScript", required: true, minLevel: "INTERMEDIATE" },
  ],
  minYearsExperience: 2,
  educationLevel: "NONE",
  workMode: "REMOTE",
  employmentType: "FULL_TIME",
  city: null,
  countryCode: null,
  salaryMin: 55000,
  salaryMax: 75000,
  salaryCurrency: "USD",
  salaryPeriod: "YEAR",
  languages: [],
  industryId: "tech",
  industryName: "Technology",
  ...over,
});

describe("computeMatch", () => {
  it("weights sum to 100", () => {
    expect(Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("scores the spec example (3/3 skills, 3 yrs vs 2+, remote) as a full match with clear reasons", () => {
    const m = computeMatch(candidate(), job());
    expect(m.score).toBe(100);
    const skills = m.criteria.find((c) => c.key === "skills")!;
    expect(skills.detail).toContain("3/3 required skills");
    expect(m.highlights.map((h) => h.key)).toEqual(expect.arrayContaining(["hlSkills", "hlExperience", "hlRemote"]));
    expect(m.highlights[0]).toEqual({ key: "hlSkills", vars: { n: 3 } });
  });

  it("excludes not-applicable criteria from the denominator", () => {
    const m = computeMatch(candidate({ preferredEmploymentTypes: [], desiredSalaryMin: null }), job({ salaryMin: null, salaryMax: null }));
    expect(m.criteria.find((c) => c.key === "salary")!.status).toBe("na");
    expect(m.criteria.find((c) => c.key === "employmentType")!.status).toBe("na");
    expect(m.score).toBe(100);
  });

  it("gives partial credit for skills one level below the requirement", () => {
    expect(skillCredit("INTERMEDIATE", "ADVANCED")).toBe(0.6);
    expect(skillCredit("BEGINNER", "EXPERT")).toBe(0.3);
    expect(skillCredit(undefined, "BEGINNER")).toBe(0);
    const m = computeMatch(candidate(), job({ skills: [{ skillId: "ts", name: "TypeScript", required: true, minLevel: "ADVANCED" }] }));
    const skills = m.criteria.find((c) => c.key === "skills")!;
    expect(skills.status).toBe("partial");
    expect(skills.earned).toBeCloseTo(MATCH_WEIGHTS.skills * 0.6, 1);
  });

  it("lists missing required skills", () => {
    const m = computeMatch(
      candidate(),
      job({ skills: [...job().skills, { skillId: "node", name: "Node.js", required: true, minLevel: "INTERMEDIATE" }] }),
    );
    expect(m.missingSkills).toEqual(["Node.js"]);
    expect(m.score).toBeLessThan(100);
  });

  it("scales experience proportionally when short of the minimum", () => {
    const m = computeMatch(candidate({ yearsExperience: 2 }), job({ minYearsExperience: 4 }));
    const exp = m.criteria.find((c) => c.key === "experience")!;
    expect(exp.status).toBe("partial");
    expect(exp.earned).toBe(MATCH_WEIGHTS.experience * 0.5);
  });

  it("scores on-site location by city, country, then relocation", () => {
    const onsite = (city: string, cc: string) => job({ workMode: "ONSITE", city, countryCode: cc });
    const c = candidate({ preferredWorkModes: [] });
    expect(computeMatch(c, onsite("Dubai", "AE")).criteria[2]!.earned).toBe(MATCH_WEIGHTS.location);
    expect(computeMatch(c, onsite("Abu Dhabi", "AE")).criteria[2]!.earned).toBeCloseTo(MATCH_WEIGHTS.location * 0.6, 1);
    expect(computeMatch(c, onsite("Berlin", "DE")).criteria[2]!.earned).toBe(0);
    expect(computeMatch(candidate({ preferredWorkModes: [], openToRelocate: true }), onsite("Berlin", "DE")).criteria[2]!.earned).toBe(
      MATCH_WEIGHTS.location * 0.5,
    );
  });

  it("does not compare salaries across currencies", () => {
    const m = computeMatch(candidate(), job({ salaryCurrency: "EUR" }));
    expect(m.criteria.find((c) => c.key === "salary")!.status).toBe("na");
  });

  it("normalises salary periods to yearly before comparing", () => {
    const m = computeMatch(candidate({ desiredSalaryMin: 5000, salaryPeriod: "MONTH" }), job({ salaryMin: 50000, salaryMax: 65000 }));
    expect(m.criteria.find((c) => c.key === "salary")!.status).toBe("met");
  });

  it("only uses availability from the recruiter perspective", () => {
    expect(computeMatch(candidate(), job(), "seeker").criteria.find((c) => c.key === "availability")!.status).toBe("na");
    expect(
      computeMatch(candidate({ availability: "THREE_MONTHS" }), job(), "recruiter").criteria.find((c) => c.key === "availability")!.status,
    ).toBe("partial");
  });

  it("is deterministic", () => {
    expect(computeMatch(candidate(), job())).toEqual(computeMatch(candidate(), job()));
  });
});
