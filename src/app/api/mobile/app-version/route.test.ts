import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/mobile/app-version", () => {
  it("answers the default version and the APK's address", async () => {
    vi.stubEnv("MOBILE_APP_LATEST_VERSION", "");
    const body = await GET().json();
    expect(body.latestVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.downloadUrl).toMatch(/\/app\/getjoblio\.apk$/);
  });

  it("uses MOBILE_APP_LATEST_VERSION when it's a real version, and ignores anything else", async () => {
    vi.stubEnv("MOBILE_APP_LATEST_VERSION", "1.4.0");
    expect((await GET().json()).latestVersion).toBe("1.4.0");
    vi.stubEnv("MOBILE_APP_LATEST_VERSION", "latest");
    expect((await GET().json()).latestVersion).not.toBe("latest");
  });
});
