import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = { pushDevice: { findMany: vi.fn(), deleteMany: vi.fn() } };
vi.mock("@/server/db", () => ({ db }));

const { isExpoPushToken, sendPush } = await import("./push");

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const ticketsResponse = (data: unknown[]) => new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } });

describe("isExpoPushToken", () => {
  it("accepts Expo push tokens only", () => {
    expect(isExpoPushToken("ExponentPushToken[abc-123_XYZ]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abc]")).toBe(true);
    expect(isExpoPushToken("fcm-raw-token")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
  });
});

describe("sendPush", () => {
  it("does nothing for a member without phones", async () => {
    db.pushDevice.findMany.mockResolvedValue([]);
    await sendPush("u1", { title: "Hi" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends to every phone and forgets the ones Expo says are gone", async () => {
    db.pushDevice.findMany.mockResolvedValue([{ token: "ExponentPushToken[a]" }, { token: "ExponentPushToken[b]" }]);
    fetchMock.mockResolvedValue(ticketsResponse([{ status: "ok", id: "1" }, { status: "error", details: { error: "DeviceNotRegistered" } }]));
    await sendPush("u1", { title: "New message", body: "From Sam", data: { type: "NEW_MESSAGE" } });
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent.map((m: { to: string }) => m.to)).toEqual(["ExponentPushToken[a]", "ExponentPushToken[b]"]);
    expect(sent[0]).toMatchObject({ title: "New message", body: "From Sam", data: { type: "NEW_MESSAGE" }, channelId: "default" });
    expect(db.pushDevice.deleteMany).toHaveBeenCalledWith({ where: { token: { in: ["ExponentPushToken[b]"] } } });
  });

  it("sends in batches of 100", async () => {
    db.pushDevice.findMany.mockResolvedValue(Array.from({ length: 150 }, (_, i) => ({ token: `ExponentPushToken[t${i}]` })));
    fetchMock.mockImplementation(async (_url, init) => ticketsResponse(JSON.parse(init.body).map(() => ({ status: "ok", id: "x" }))));
    await sendPush("u1", { title: "Hi" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toHaveLength(50);
  });

  it("never throws, even when Expo can't be reached", async () => {
    db.pushDevice.findMany.mockResolvedValue([{ token: "ExponentPushToken[a]" }]);
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(sendPush("u1", { title: "Hi" })).resolves.toBeUndefined();
    expect(db.pushDevice.deleteMany).not.toHaveBeenCalled();
  });
});
