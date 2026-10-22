import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { db, getSessionCookie } = vi.hoisted(() => ({
  db: { job: { findUnique: vi.fn() }, company: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } },
  getSessionCookie: vi.fn(),
}));
vi.mock("@/server/db", () => ({ db }));
vi.mock("better-auth/cookies", () => ({ getSessionCookie }));

import { proxy } from "./proxy";

const page = (path: string) => new NextRequest(`https://www.getjoblio.app${path}`, { headers: { accept: "text/html" } });
const rewrittenTo = (res: Response) => res.headers.get("x-middleware-rewrite");

beforeEach(() => {
  vi.clearAllMocks();
  getSessionCookie.mockReturnValue(null);
});

describe("proxy: removed listings answer 410, missing ones 404", () => {
  it("serves an open job normally", async () => {
    db.job.findUnique.mockResolvedValue({ status: "OPEN" });
    const res = await proxy(page("/jobs/job1"));
    expect(res.status).toBe(200);
    expect(rewrittenTo(res)).toBeNull();
  });

  it("answers 410 Gone for a closed job to visitors and crawlers", async () => {
    db.job.findUnique.mockResolvedValue({ status: "CLOSED" });
    const res = await proxy(page("/jobs/job2"));
    expect(res.status).toBe(410);
    expect(rewrittenTo(res)).toContain("/gone?kind=job");
  });

  it("lets a signed-in member reach a closed job (the posting team, admins)", async () => {
    getSessionCookie.mockReturnValue("session-token");
    db.job.findUnique.mockResolvedValue({ status: "CLOSED" });
    const res = await proxy(page("/jobs/job3"));
    expect(res.status).toBe(200);
    expect(rewrittenTo(res)).toBeNull();
  });

  it("keeps a real 404 for a job that never existed", async () => {
    db.job.findUnique.mockResolvedValue(null);
    const res = await proxy(page("/jobs/nope"));
    expect(res.status).toBe(404);
  });

  it("answers 410 for an imported company with no open job, 200 for a real one", async () => {
    db.company.findUnique.mockResolvedValue({ importSource: "JOBICY", _count: { jobs: 0 } });
    const hidden = await proxy(page("/companies/acme"));
    expect(hidden.status).toBe(410);
    expect(rewrittenTo(hidden)).toContain("/gone?kind=company");
    db.company.findUnique.mockResolvedValue({ importSource: null, _count: { jobs: 0 } });
    expect((await proxy(page("/companies/real-co"))).status).toBe(200);
  });
});
