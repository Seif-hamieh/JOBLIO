import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const db = {
  skill: { count: vi.fn(), createMany: vi.fn() },
  industry: { count: vi.fn(), createMany: vi.fn() },
};
vi.mock("@/server/db", () => ({ db }));

async function load() {
  vi.resetModules();
  return (await import("./reference-data")).ensureReferenceData;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  db.skill.createMany.mockResolvedValue({ count: 1 });
  db.industry.createMany.mockResolvedValue({ count: 1 });
});

describe("ensureReferenceData", () => {
  it("fills empty tables from the built-in lists", async () => {
    db.skill.count.mockResolvedValue(0);
    db.industry.count.mockResolvedValue(0);
    await (await load())();
    expect(db.skill.createMany).toHaveBeenCalledOnce();
    expect(db.industry.createMany).toHaveBeenCalledOnce();
    expect(db.skill.createMany.mock.calls[0]![0].data.length).toBeGreaterThanOrEqual(100);
    expect(db.skill.createMany.mock.calls[0]![0].skipDuplicates).toBe(true);
  });

  it("leaves tables that already have rows alone", async () => {
    db.skill.count.mockResolvedValue(160);
    db.industry.count.mockResolvedValue(0);
    await (await load())();
    expect(db.skill.createMany).not.toHaveBeenCalled();
    expect(db.industry.createMany).toHaveBeenCalledOnce();
  });

  it("checks only once per server instance", async () => {
    db.skill.count.mockResolvedValue(5);
    db.industry.count.mockResolvedValue(5);
    const ensure = await load();
    await Promise.all([ensure(), ensure(), ensure()]);
    expect(db.skill.count).toHaveBeenCalledOnce();
  });

  it("retries after a database error instead of failing the page", async () => {
    db.skill.count.mockRejectedValueOnce(new Error("connection lost")).mockResolvedValue(5);
    db.industry.count.mockResolvedValue(5);
    const ensure = await load();
    await expect(ensure()).resolves.toBeUndefined();
    await ensure();
    expect(db.skill.count).toHaveBeenCalledTimes(2);
  });
});
