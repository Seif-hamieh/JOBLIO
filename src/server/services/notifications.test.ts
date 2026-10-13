import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/realtime", () => ({ publish: vi.fn(), isOnline: vi.fn() }));
vi.mock("@/server/mail", () => ({ escapeHtml: (s: string) => s, sendEmail: vi.fn() }));
const db = { company: { findMany: vi.fn() }, companyMember: { findMany: vi.fn() } };
vi.mock("@/server/db", () => ({ db }));

const { withCurrentCompanyNames } = await import("./notifications");

beforeEach(() => vi.clearAllMocks());

describe("withCurrentCompanyNames", () => {
  it("shows a renamed company's current name (by stored companyId)", async () => {
    db.company.findMany.mockResolvedValue([{ id: "co1", name: "Glow Glam" }]);
    db.companyMember.findMany.mockResolvedValue([]);
    const [n] = await withCurrentCompanyNames([{ actorId: "r1", vars: { company: "ttttt", companyId: "co1", job: "Designer" } }]);
    expect(n!.vars).toMatchObject({ company: "Glow Glam", job: "Designer" });
  });

  it("falls back to the sender's company for older notifications without an id", async () => {
    db.company.findMany.mockResolvedValue([]);
    db.companyMember.findMany.mockResolvedValue([{ userId: "r1", company: { name: "Glow Glam" } }]);
    const [n] = await withCurrentCompanyNames([{ actorId: "r1", vars: { company: "ttttt" } }]);
    expect(n!.vars).toMatchObject({ company: "Glow Glam" });
  });

  it("leaves it alone when the sender belongs to several companies (ambiguous)", async () => {
    db.company.findMany.mockResolvedValue([]);
    db.companyMember.findMany.mockResolvedValue([
      { userId: "r1", company: { name: "A" } },
      { userId: "r1", company: { name: "B" } },
    ]);
    const [n] = await withCurrentCompanyNames([{ actorId: "r1", vars: { company: "ttttt" } }]);
    expect(n!.vars).toMatchObject({ company: "ttttt" });
  });

  it("does nothing for notifications without a company", async () => {
    const rows = [{ actorId: "u", vars: { name: "Maya" } }];
    expect(await withCurrentCompanyNames(rows)).toBe(rows);
    expect(db.company.findMany).not.toHaveBeenCalled();
  });
});
