import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getViewer } = vi.hoisted(() => ({
  db: { job: { findUnique: vi.fn() }, jobReport: { findFirst: vi.fn(), create: vi.fn() } },
  getViewer: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/session", () => ({ getViewer }));
vi.mock("@/server/services/jobs", () => ({ anonymousViewerKey: async () => "a:visitor-key" }));
vi.mock("@/i18n/server", () => ({ getI18n: async () => ({ t: (key: string) => key }) }));

import { reportJobAction } from "./reports";

beforeEach(() => vi.clearAllMocks());

describe("reportJobAction", () => {
  it("records a visitor's report on an open job", async () => {
    getViewer.mockResolvedValue(null);
    db.job.findUnique.mockResolvedValue({ status: "OPEN" });
    db.jobReport.findFirst.mockResolvedValue(null);
    const res = await reportJobAction({ jobId: "job1", reason: "SCAM", details: "Asks for a fee" });
    expect(res?.ok).toBe(true);
    expect(db.jobReport.create).toHaveBeenCalledWith({ data: { jobId: "job1", reporterId: null, reporterKey: "a:visitor-key", reason: "SCAM", details: "Asks for a fee" } });
  });

  it("does not store a second open report from the same person", async () => {
    getViewer.mockResolvedValue({ id: "u1" });
    db.job.findUnique.mockResolvedValue({ status: "OPEN" });
    db.jobReport.findFirst.mockResolvedValue({ id: "r1" });
    const res = await reportJobAction({ jobId: "job2", reason: "FAKE" });
    expect(res?.ok).toBe(true);
    expect(db.jobReport.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { jobId: "job2", reporterKey: "u:u1", status: "OPEN" } }));
    expect(db.jobReport.create).not.toHaveBeenCalled();
  });

  it("rejects unknown reasons and jobs that aren't open", async () => {
    getViewer.mockResolvedValue(null);
    expect((await reportJobAction({ jobId: "job3", reason: "BORING" }))?.ok).toBe(false);
    db.job.findUnique.mockResolvedValue({ status: "CLOSED" });
    expect((await reportJobAction({ jobId: "job3", reason: "FAKE" }))?.ok).toBe(false);
    expect(db.jobReport.create).not.toHaveBeenCalled();
  });
});
