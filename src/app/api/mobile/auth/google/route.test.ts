import { afterEach, describe, expect, it, vi } from "vitest";

const { forwardToAuth, tokenFromSetCookie, memberCompany } = vi.hoisted(() => ({
  forwardToAuth: vi.fn(),
  tokenFromSetCookie: vi.fn(),
  memberCompany: vi.fn(),
}));
vi.mock("@/server/mobile/auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    forwardToAuth,
    tokenFromSetCookie,
    mobileError: (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status }),
  };
});
vi.mock("@/server/mobile/dto", () => ({ memberCompany, toMe: (user: { id: string }, company: unknown) => ({ id: user.id, company }) }));

import { POST } from "./route";

const ID_TOKEN = "eyJhbGciOiJSUzI1NiJ9.payload.signature";
const call = (body: unknown) => POST(new Request("https://www.getjoblio.app/api/mobile/auth/google", { method: "POST", body: JSON.stringify(body) }));
const authAnswer = (status: number, json: unknown) => new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.clearAllMocks());

describe("POST /api/mobile/auth/google", () => {
  it("needs an idToken", async () => {
    expect((await call({})).status).toBe(400);
    expect(forwardToAuth).not.toHaveBeenCalled();
  });

  it("signs in through Better Auth's social sign-in with the Google ID token", async () => {
    forwardToAuth.mockResolvedValue(authAnswer(200, { redirect: false, user: { id: "u1" } }));
    tokenFromSetCookie.mockResolvedValue("session-token");
    memberCompany.mockResolvedValue(null);
    const res = await call({ idToken: ID_TOKEN });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "session-token", user: { id: "u1", company: null } });
    expect(forwardToAuth).toHaveBeenCalledWith(expect.any(Request), "/sign-in/social", expect.objectContaining({ provider: "google", idToken: { token: ID_TOKEN } }));
  });

  it("retries once when the token is refused, and signs in if the second check passes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    forwardToAuth.mockResolvedValueOnce(authAnswer(401, { code: "INVALID_TOKEN" })).mockResolvedValueOnce(authAnswer(200, { user: { id: "u1" } }));
    tokenFromSetCookie.mockResolvedValue("session-token");
    memberCompany.mockResolvedValue(null);
    const res = await call({ idToken: ID_TOKEN });
    expect(res.status).toBe(200);
    expect(forwardToAuth).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it.each([
    ["INVALID_TOKEN", 401, 401],
    ["ACCOUNT_BANNED", 403, 403],
    ["PROVIDER_NOT_FOUND", 404, 503],
  ])("maps Better Auth's %s to a clear error", async (code, authStatus, status) => {
    forwardToAuth.mockResolvedValue(authAnswer(authStatus, { code }));
    const res = await call({ idToken: ID_TOKEN });
    expect(res.status).toBe(status);
    expect(tokenFromSetCookie).not.toHaveBeenCalled();
  });
});
