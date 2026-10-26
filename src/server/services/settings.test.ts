import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = {
  userSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  session: { deleteMany: vi.fn() },
};
vi.mock("@/server/db", () => ({ db }));

const { getNotificationSettings, revokeOtherSessions, revokeSession } = await import("./settings");

beforeEach(() => vi.clearAllMocks());

describe("sessions", () => {
  it("signs out every other device, never the current one", async () => {
    db.session.deleteMany.mockResolvedValue({ count: 2 });
    expect(await revokeOtherSessions("u1", "current")).toBe(2);
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", id: { not: "current" } } });
  });

  it("signs out one of your own devices, and refuses the current one", async () => {
    db.session.deleteMany.mockResolvedValue({ count: 1 });
    expect(await revokeSession("u1", "other", "current")).toBe(1);
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { id: "other", userId: "u1" } });
    expect(await revokeSession("u1", "current", "current")).toBe(0);
    expect(db.session.deleteMany).toHaveBeenCalledTimes(1);
  });
});

describe("notification settings", () => {
  it("are all on until the member changes them", async () => {
    db.userSettings.findUnique.mockResolvedValue(null);
    expect(Object.values(await getNotificationSettings("u1")).every(Boolean)).toBe(true);
  });

  it("keep what the member saved", async () => {
    db.userSettings.findUnique.mockResolvedValue({ emailNotifications: false, notifyMessages: true, notifyApplications: false, notifyNetwork: true, notifyJobAlerts: true, notifyPosts: false, notifyProfileViews: true });
    expect(await getNotificationSettings("u1")).toMatchObject({ emailNotifications: false, notifyApplications: false, notifyPosts: false, notifyMessages: true });
  });
});
