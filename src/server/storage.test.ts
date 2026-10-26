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
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "key");
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

  it("falls back to local storage when the supabase driver is chosen without credentials", () => {
    vi.stubEnv("STORAGE_DRIVER", "supabase");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(storage.storageDriver()).toBe("local");
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    expect(storage.storageDriver()).toBe("local");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "key");
    expect(storage.storageDriver()).toBe("supabase");
  });
});

describe("signed links to private files (local storage)", () => {
  const PDF = Buffer.from("%PDF-1.4\n%test\n");

  it("open the file for a few minutes, and can't be changed or reused for another file", async () => {
    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
    const stored = await storage.storeUpload(new File([PDF], "cv.pdf"), "resume", "u1");
    const key = stored.key;
    const link = new URL((await storage.privateFileLink(key, 300))!);
    const exp = link.searchParams.get("exp");
    const sig = link.searchParams.get("sig");
    expect(link.pathname).toBe(`/api/v1/files/${key}`);
    expect(storage.verifyFileLink(key, exp, sig)).toBe(true);
    // Another file, a later expiry or a forged signature: refused.
    expect(storage.verifyFileLink(key.replace("u1", "u2"), exp, sig)).toBe(false);
    expect(storage.verifyFileLink(key, String(Number(exp) + 3600), sig)).toBe(false);
    expect(storage.verifyFileLink(key, exp, sig!.slice(0, -2) + "xx")).toBe(false);
    expect(storage.verifyFileLink(key, null, sig)).toBe(false);
    // A different site secret signs differently.
    vi.stubEnv("BETTER_AUTH_SECRET", "another-secret");
    expect(storage.verifyFileLink(key, exp, sig)).toBe(false);
  });

  it("stop working once they expire", async () => {
    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
    const stored = await storage.storeUpload(new File([PDF], "cv.pdf"), "resume", "u1");
    const link = new URL((await storage.privateFileLink(stored.key, -1))!);
    expect(storage.verifyFileLink(stored.key, link.searchParams.get("exp"), link.searchParams.get("sig"))).toBe(false);
  });

  it("aren't made for a file that doesn't exist", async () => {
    vi.stubEnv("STORAGE_DRIVER", "local");
    expect(await storage.privateFileLink("private/resume/u1/missing.pdf")).toBeNull();
  });
});
