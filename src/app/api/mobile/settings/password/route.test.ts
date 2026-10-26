import { afterEach, describe, expect, it, vi } from "vitest";

const { forwardToAuth, tokenFromSetCookie, getMobileSession, findFirst } = vi.hoisted(() => ({
  forwardToAuth: vi.fn(),
  tokenFromSetCookie: vi.fn(),
  getMobileSession: vi.fn(),
  findFirst: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ db: { account: { findFirst } } }));
vi.mock("@/server/mobile/auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    forwardToAuth,
    tokenFromSetCookie,
    getMobileSession,
    bearerToken: (req: Request) => req.headers.get("authorization")?.slice(7) ?? null,
    mobileError: (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status }),
  };
});

import { POST } from "./route";

let n = 0;
const call = (body: unknown) =>
  // A different member each time, so the sensitive-action rate limit (5 per 15 minutes) never kicks in here.
  (getMobileSession.mockResolvedValue({ user: { id: `u${++n}`, email: "sam@example.com", name: "Sam Rivera" }, session: { id: "s1" } }),
  POST(new Request("https://www.getjoblio.app/api/mobile/settings/password", { method: "POST", headers: { authorization: "Bearer old.token" }, body: JSON.stringify(body) })));
const authAnswer = (status: number, json: unknown) => new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
const GOOD = { currentPassword: "old-password-1", newPassword: "Violet-harbor-71" };

afterEach(() => vi.clearAllMocks());

describe("POST /api/mobile/settings/password", () => {
  it("changes the password, signs out other devices, and hands this phone its new token", async () => {
    findFirst.mockResolvedValue({ id: "acc" });
    forwardToAuth.mockResolvedValue(authAnswer(200, { token: null }));
    tokenFromSetCookie.mockResolvedValue("new.token");
    const res = await call(GOOD);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "new.token" });
    expect(forwardToAuth).toHaveBeenCalledWith(expect.any(Request), "/change-password", { ...GOOD, revokeOtherSessions: true }, "old.token");
  });

  it("says when the current password is wrong", async () => {
    findFirst.mockResolvedValue({ id: "acc" });
    forwardToAuth.mockResolvedValue(authAnswer(400, { code: "INVALID_PASSWORD" }));
    const res = await call(GOOD);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("WRONG_PASSWORD");
  });

  it("refuses a short, unchanged or personal password before asking Better Auth", async () => {
    findFirst.mockResolvedValue({ id: "acc" });
    expect((await call({ currentPassword: "x", newPassword: "short" })).status).toBe(400);
    expect((await call({ currentPassword: "Same-password-9", newPassword: "Same-password-9" })).status).toBe(400);
    expect((await (await call({ currentPassword: "x", newPassword: "riveraexample9" })).json()).error.code).toBe("WEAK_PASSWORD");
    expect(forwardToAuth).not.toHaveBeenCalled();
  });

  it("explains there's no password for Google-only accounts", async () => {
    findFirst.mockResolvedValue(null);
    expect((await (await call(GOOD)).json()).error.code).toBe("NO_PASSWORD");
  });
});
