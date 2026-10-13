import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/action", () => ({ ActionError: class ActionError extends Error {} }));
vi.mock("@/server/services/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/services/achievements", () => ({ checkAchievements: vi.fn() }));
vi.mock("@/server/services/matching", () => ({ candidateMatchSelect: {}, jobMatchSelect: {}, toCandidateFacts: vi.fn(), toJobFacts: vi.fn() }));

const tx = { application: { update: vi.fn() }, applicationEvent: { create: vi.fn() } };
const db = {
  application: { findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
};
vi.mock("@/server/db", () => ({ db }));

const { transitionApplication } = await import("./applications");
const { notify } = await import("@/server/services/notifications");

const actor = { id: "recruiter", companyId: "co" };
const app = (status: string, stage: string) => ({
  id: "app",
  status,
  stage,
  applicantId: "candidate",
  viewedAt: new Date(),
  job: { id: "job", title: "Designer", companyId: "co", company: { name: "Glow Glam" } },
});

beforeEach(() => vi.clearAllMocks());

describe("transitionApplication — Hired is final", () => {
  it("refuses to move a hired candidate to another stage without confirmation", async () => {
    db.application.findUnique.mockResolvedValue(app("HIRED", "HIRED"));
    await expect(transitionApplication(actor, "app", { stage: "INTERVIEW" })).rejects.toThrow("@msg.hiredLocked");
    expect(tx.application.update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuses to decline a hired candidate", async () => {
    db.application.findUnique.mockResolvedValue(app("HIRED", "HIRED"));
    await expect(transitionApplication(actor, "app", { status: "REJECTED" })).rejects.toThrow("@msg.cannotDeclineHired");
  });

  it("allows leaving Hired when the move was explicitly confirmed, and tells the candidate", async () => {
    db.application.findUnique.mockResolvedValue(app("HIRED", "HIRED"));
    await expect(transitionApplication(actor, "app", { stage: "INTERVIEW", leaveHired: true })).resolves.toEqual({ status: "INTERVIEW", stage: "INTERVIEW" });
    expect(tx.application.update).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledOnce();
  });

  it("stores the company id with the company name in the notification", async () => {
    db.application.findUnique.mockResolvedValue(app("SHORTLISTED", "SCREENING"));
    await transitionApplication(actor, "app", { stage: "INTERVIEW" });
    const title = vi.mocked(notify).mock.calls[0]![0].title;
    expect(title).toContain("Glow Glam");
    expect(title).toContain('"companyId":"co"');
  });
});
