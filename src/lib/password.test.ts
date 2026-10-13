import { describe, expect, it } from "vitest";
import { assessPassword } from "./password";

describe("assessPassword", () => {
  it.each([
    ["aaaaaaaaaaaa", "repeated"],
    ["1234567890", "sequence"],
    ["0987654321", "sequence"],
    ["7890123456", "sequence"],
    ["qwertyuiop", "sequence"],
    ["abcdefghijk", "sequence"],
    ["password123", "common"],
    ["Password123!", "common"],
    ["ababababab", "repeated"],
    ["short1!", "tooShort"],
  ])("rejects %s (%s)", (pw, problem) => {
    // Some patterns are also on the common list; either reason rejects them.
    expect([problem, "common"]).toContain(assessPassword(pw).problem);
    expect(assessPassword(pw).level).toBe("weak");
  });

  it("rejects a password that is mostly the user's name or email", () => {
    expect(assessPassword("mayachen2026", ["Maya Chen", "maya@joblio.dev"]).problem).toBe("personal");
  });

  it("grades acceptable passwords", () => {
    expect(assessPassword("bluerivertea").problem).toBeNull(); // allowed, though not strong
    expect(assessPassword("bluerivertea7").level).toBe("medium");
    expect(assessPassword("Blue-River-Tea-7").level).toBe("strong");
    expect(assessPassword("Blue-River-Tea-7").problem).toBeNull();
  });
});
