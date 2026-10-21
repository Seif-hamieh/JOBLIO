import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { employmentTypeFrom, experienceLevelFrom, htmlToText, salaryFrom, singleCountry } from "./normalize";

describe("job import normalization", () => {
  it("turns listing HTML (also escaped HTML) into plain paragraphs and bullets", () => {
    expect(htmlToText("<p>Hello&nbsp;<b>world</b></p><ul><li>One</li><li>Two &amp; three</li></ul>")).toBe("Hello world\n\n• One\n• Two & three");
    expect(htmlToText("&lt;p&gt;Escaped&lt;/p&gt;&lt;p&gt;Twice&lt;/p&gt;")).toBe("Escaped\n\nTwice");
    expect(htmlToText("<script>alert(1)</script><p>Safe</p>")).toBe("Safe");
  });

  it("maps job types and seniority", () => {
    expect(employmentTypeFrom(["Unbefristeter arbeitsvertrag"])).toBe("FULL_TIME");
    expect(employmentTypeFrom(["Teilzeit"])).toBe("PART_TIME");
    expect(employmentTypeFrom(["Contract"])).toBe("CONTRACT");
    expect(experienceLevelFrom([], "Account Executive - Splunk")).toBe("MID");
    expect(experienceLevelFrom(["Senior"], "Account Executive")).toBe("SENIOR");
    expect(experienceLevelFrom([], "Director of Engineering")).toBe("EXECUTIVE");
    expect(experienceLevelFrom([], "Junior Developer")).toBe("ENTRY");
    expect(experienceLevelFrom(["Midweight"], "Product Manager")).toBe("MID");
  });

  it("keeps a country only when exactly one is named", () => {
    expect(singleCountry(["USA"])).toBe("US");
    expect(singleCountry(["United Kingdom"])).toBe("GB");
    expect(singleCountry(["USA, Canada"])).toBeNull();
    expect(singleCountry(["Anywhere"])).toBeNull();
  });

  it("validates salaries", () => {
    expect(salaryFrom(165000, 215000, "usd")).toEqual({ salaryMin: 165000, salaryMax: 215000, salaryCurrency: "USD" });
    expect(salaryFrom(null, null, "USD")).toEqual({ salaryMin: null, salaryMax: null, salaryCurrency: null });
    expect(salaryFrom(5000, 100, "EUR")).toEqual({ salaryMin: 5000, salaryMax: null, salaryCurrency: "EUR" });
  });
});
