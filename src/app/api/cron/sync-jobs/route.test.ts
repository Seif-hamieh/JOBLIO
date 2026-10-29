import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, syncAllSources, runJobAlerts } = vi.hoisted(() => ({ findFirst: vi.fn(), syncAllSources: vi.fn(), runJobAlerts: vi.fn() }));
vi.mock("@/server/db", () => ({ db: { user: { findFirst } } }));
vi.mock("@/server/job-import/import", () => ({ syncAllSources }));
vi.mock("@/server/services/job-alerts", () => ({ runJobAlerts }));
vi.mock("@/server/services/storage-cleanup", () => ({ cleanupStorage: async () => ({ expiredStories: 0, orphans: 0, bytes: 0 }) }));

import { GET } from "./route";

beforeEach(() => runJobAlerts.mockResolvedValue({ checked: 0, notified: 0 }));

const call = (auth?: string) => GET(new Request("https://getjoblio.app/api/cron/sync-jobs", { headers: auth ? { authorization: auth } : {} }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/cron/sync-jobs", () => {
  it("refuses to run without CRON_SECRET configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer anything")).status).toBe(500);
    expect(syncAllSources).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call("s3cret-value")).status).toBe(401);
    expect(syncAllSources).not.toHaveBeenCalled();
  });

  it("needs IMPORT_USER_EMAIL to match an account", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    vi.stubEnv("IMPORT_USER_EMAIL", "admin@example.com");
    findFirst.mockResolvedValue(null);
    expect((await call("Bearer s3cret-value")).status).toBe(500);
    expect(syncAllSources).not.toHaveBeenCalled();
  });

  it("imports as the configured account with the right token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    vi.stubEnv("IMPORT_USER_EMAIL", "admin@example.com");
    findFirst.mockResolvedValue({ id: "u1" });
    syncAllSources.mockResolvedValue([{ source: "JOBICY", fetched: 3, created: 2, skipped: 1, failed: 0 }]);
    const res = await call("Bearer s3cret-value");
    expect(res.status).toBe(200);
    expect(syncAllSources).toHaveBeenCalledWith("u1");
    expect(await res.json()).toMatchObject({ ok: true, created: 2 });
  });

  it("runs job alerts after the import and reports how many had new jobs", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");
    vi.stubEnv("IMPORT_USER_EMAIL", "admin@example.com");
    findFirst.mockResolvedValue({ id: "u1" });
    syncAllSources.mockResolvedValue([]);
    runJobAlerts.mockResolvedValue({ checked: 4, notified: 1 });
    expect(await (await call("Bearer s3cret-value")).json()).toMatchObject({ ok: true, alerts: { checked: 4, notified: 1 } });
  });
});
