import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
let cwd: string;
let storage: typeof import("./storage");

beforeAll(async () => {
  cwd = await mkdtemp(join(tmpdir(), "joblio-storage-"));
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  storage = await import("./storage");
});
afterAll(() => rm(cwd, { recursive: true, force: true }));
afterEach(() => vi.unstubAllEnvs());

describe("storage", () => {
  it("picks the driver from STORAGE_DRIVER, falling back to SUPABASE_URL", () => {
    vi.stubEnv("STORAGE_DRIVER", "");
    vi.stubEnv("SUPABASE_URL", "");
    expect(storage.storageDriver()).toBe("local");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    expect(storage.storageDriver()).toBe("supabase");
    vi.stubEnv("STORAGE_DRIVER", "local");
    expect(storage.storageDriver()).toBe("local");
  });

  it("only maps our own file URLs back to keys", () => {
    expect(storage.keyFromUrl("/api/v1/files/public/avatar/a.png")).toBe("public/avatar/a.png");
    expect(storage.keyFromUrl("/media/seed/a.svg")).toBeNull();
    expect(storage.keyFromUrl("/api/v1/files/public/avatar/../../x")).toBeNull();
    expect(storage.keyFromUrl(null)).toBeNull();
  });

  it("stores with a UUID name and deletes with the local driver", async () => {
    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("VERCEL", "");
    const stored = await storage.storeUpload(new File([PNG], "me.png"), "avatar", "u1");
    expect(stored.key).toMatch(/^public\/avatar\/[0-9a-f-]{36}\.png$/);
    expect(stored.url).toBe(`/api/v1/files/${stored.key}`);
    expect((await storage.readStored(stored.key))?.mime).toBe("image/png");

    await storage.deleteStored([stored.url, "/media/keep.svg", null]);
    expect(await storage.readStored(stored.key)).toBeNull();
    expect(await readdir(join(cwd, "storage", "public", "avatar"))).toEqual([]);
  });

  it("keeps CVs under a private, per-owner path", async () => {
    vi.stubEnv("STORAGE_DRIVER", "local");
    const pdf = Buffer.from("%PDF-1.7\n");
    const stored = await storage.storeUpload(new File([pdf], "cv.pdf"), "resume", "user_1");
    expect(stored.key).toMatch(/^private\/resume\/user_1\/[0-9a-f-]{36}\.pdf$/);
  });

  it("refuses the local driver on Vercel", async () => {
    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("VERCEL", "1");
    await expect(storage.storeUpload(new File([PNG], "a.png"), "post", "u1")).rejects.toThrow(/Vercel/);
  });

  it("requires Supabase credentials when the supabase driver is chosen", async () => {
    vi.stubEnv("STORAGE_DRIVER", "supabase");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(storage.storeUpload(new File([PNG], "a.png"), "post", "u1")).rejects.toThrow(/SUPABASE_URL/);
  });
});
