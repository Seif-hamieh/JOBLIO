import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const notify = vi.fn();
vi.mock("@/server/services/notifications", () => ({ notify }));
vi.mock("@/server/services/jobs", () => ({ buildJobWhere: (p: { q?: string; mode: string[] }) => ({ status: "OPEN", q: p.q ?? null, mode: p.mode }) }));
const db = {
  savedSearch: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  job: { count: vi.fn(), findMany: vi.fn() },
};
vi.mock("@/server/db", () => ({ db }));

const { runJobAlerts, setJobAlertEnabled, createJobAlert } = await import("./job-alerts");

const NOW = new Date("2026-10-27T02:00:00Z");
const alert = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  userId: "u1",
  name: "React jobs",
  params: { q: "react", mode: ["REMOTE", "HYBRID"], posted: "7" },
  lastAlertedAt: new Date("2026-10-26T02:00:00Z"),
  createdAt: new Date("2026-10-01T00:00:00Z"),
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("runJobAlerts", () => {
  it("finds jobs published since the last check with the search's own filters, and notifies once", async () => {
    db.savedSearch.findMany.mockResolvedValue([alert()]);
    db.job.count.mockResolvedValue(2);
    db.job.findMany.mockResolvedValue([{ title: "Frontend Engineer" }, { title: "React Developer" }]);
    expect(await runJobAlerts(NOW)).toEqual({ checked: 1, notified: 1 });

    const where = db.job.count.mock.calls[0]![0].where;
    // The search's filters (lists stay lists), only new jobs, never the member's own posts.
    expect(where.AND[0]).toMatchObject({ q: "react", mode: ["REMOTE", "HYBRID"] });
    expect(where.AND[1]).toEqual({ publishedAt: { gt: new Date("2026-10-26T02:00:00Z"), lte: NOW } });
    expect(where.AND[2]).toEqual({ postedById: { not: "u1" } });

    const n = notify.mock.calls[0]![0];
    expect(n).toMatchObject({ userId: "u1", type: "JOB_ALERT" });
    expect(n.title).toContain("notif.jobAlert");
    expect(n.body).toContain("Frontend Engineer");
    expect(n.href).toMatch(/^\/jobs\?.*q=react/);
    expect(db.savedSearch.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { lastAlertedAt: NOW } });
  });

  it("stays quiet when nothing new matched, but still moves its window forward", async () => {
    db.savedSearch.findMany.mockResolvedValue([alert({ lastAlertedAt: null })]);
    db.job.count.mockResolvedValue(0);
    db.job.findMany.mockResolvedValue([]);
    expect(await runJobAlerts(NOW)).toEqual({ checked: 1, notified: 0 });
    // A new alert counts from when it was saved.
    expect(db.job.count.mock.calls[0]![0].where.AND[1].publishedAt.gt).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(notify).not.toHaveBeenCalled();
    expect(db.savedSearch.update).toHaveBeenCalledOnce();
  });

  it("keeps going when one alert fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.savedSearch.findMany.mockResolvedValue([alert({ id: "bad" }), alert({ id: "good" })]);
    db.job.count.mockRejectedValueOnce(new Error("db hiccup")).mockResolvedValue(1);
    db.job.findMany.mockResolvedValue([{ title: "X" }]);
    expect(await runJobAlerts(NOW)).toEqual({ checked: 2, notified: 1 });
  });
});

describe("managing alerts", () => {
  it("turning one on starts from now, so old jobs aren't announced", async () => {
    db.savedSearch.updateMany.mockResolvedValue({ count: 1 });
    expect(await setJobAlertEnabled("u1", "a1", true)).toBe(true);
    expect(db.savedSearch.updateMany.mock.calls[0]![0].data.lastAlertedAt).toBeInstanceOf(Date);
    await setJobAlertEnabled("u1", "a1", false);
    expect(db.savedSearch.updateMany.mock.calls[1]![0].data).toEqual({ alertsEnabled: false });
  });

  it("refuses a new one past the saved-search limit", async () => {
    db.savedSearch.count.mockResolvedValue(25);
    expect(await createJobAlert("u1", { name: "x", params: { q: "x" } })).toBeNull();
    expect(db.savedSearch.create).not.toHaveBeenCalled();
  });
});
