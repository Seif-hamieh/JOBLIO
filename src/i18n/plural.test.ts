import { describe, expect, it } from "vitest";
import { createT, parseCount } from "./translate";

const en = createT("en");
const ar = createT("ar");

describe("plural forms", () => {
  it("uses the singular for exactly one in English", () => {
    expect(en("jobs.applicants", { n: 1 })).toBe("1 applicant");
    expect(en("jobs.applicants", { n: 2 })).toBe("2 applicants");
    expect(en("companies.jobs", { n: 1 })).toBe("1 job");
    expect(en("recruiter.candidates", { n: 1 })).toBe("1 candidate");
    expect(en("jobs.views", { n: 0 })).toBe("0 views");
  });

  it("works when the count is passed already formatted", () => {
    expect(en("jobs.views", { n: "1" })).toBe("1 view");
    expect(en("recruiter.candidates", { n: "1,204" })).toBe("1,204 candidates");
    expect(en("companies.followers", { n: "1K" })).toBe("1K followers");
  });

  it("uses all six Arabic forms", () => {
    expect(ar("jobs.applicants", { n: 0 })).toBe("لا متقدّمين");
    expect(ar("jobs.applicants", { n: 1 })).toBe("متقدّم واحد");
    expect(ar("jobs.applicants", { n: 2 })).toBe("متقدّمان");
    expect(ar("jobs.applicants", { n: 5 })).toBe("5 متقدّمين");
    expect(ar("jobs.applicants", { n: 11 })).toBe("11 متقدّمًا");
    expect(ar("jobs.applicants", { n: 100 })).toBe("100 متقدّم");
  });

  it("reads formatted counts", () => {
    expect(parseCount("1,234")).toBe(1234);
    expect(parseCount("١٢")).toBe(12);
    expect(parseCount("1.2K")).toBe(1000);
    expect(parseCount("none")).toBeNull();
  });
});
