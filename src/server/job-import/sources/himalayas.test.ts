import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isMenaJob } from "./himalayas";

describe("Himalayas MENA filter", () => {
  it("keeps jobs whose locations name an Arab country or the region", () => {
    expect(isMenaJob(["United Arab Emirates"])).toBe(true);
    expect(isMenaJob(["Bahrain", "Kuwait"])).toBe(true);
    expect(isMenaJob(["UAE"])).toBe(true);
    expect(isMenaJob(["Middle East & North Africa"])).toBe(true);
    expect(isMenaJob(["mena"])).toBe(true);
  });

  it("drops jobs elsewhere, without partial-word matches", () => {
    expect(isMenaJob(["United States", "Canada"])).toBe(false);
    expect(isMenaJob(["Romania"])).toBe(false); // contains "oman"
    expect(isMenaJob([])).toBe(false);
  });
});
