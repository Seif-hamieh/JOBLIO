import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const connectionIds = vi.fn();
vi.mock("@/server/services/network", () => ({ connectionIds }));
const db = {
  follow: { findMany: vi.fn() },
  block: { findMany: vi.fn() },
  story: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  storyView: { createMany: vi.fn() },
};
vi.mock("@/server/db", () => ({ db }));

const { listStories, markStoryViewed, createStory, STORY_TTL_MS } = await import("./stories");

const user = (id: string) => ({ id, name: id.toUpperCase(), image: null, username: id, profile: { headline: null } });
const story = (id: string, userId: string, minutesAgo: number, viewedByMe = false, views = 0) => ({
  id,
  userId,
  mediaUrl: `/api/v1/files/public/story/${id}.jpg`,
  text: null,
  createdAt: new Date(Date.now() - minutesAgo * 60_000),
  expiresAt: new Date(Date.now() + 60 * 60_000),
  user: user(userId),
  views: viewedByMe ? [{ id: "v" }] : [],
  _count: { views },
});

beforeEach(() => {
  vi.clearAllMocks();
  connectionIds.mockResolvedValue(["friend", "blocked"]);
  db.follow.findMany.mockResolvedValue([{ followingId: "followed" }]);
  db.block.findMany.mockResolvedValue([{ blockerId: "me", blockedId: "blocked" }]);
});

describe("listStories", () => {
  it("asks only for live stories from you, connections and people you follow, minus blocked members", async () => {
    db.story.findMany.mockResolvedValue([]);
    await listStories("me");
    const where = db.story.findMany.mock.calls[0]![0].where;
    expect(where.userId.in.sort()).toEqual(["followed", "friend", "me"]);
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(where.user).toEqual({ bannedAt: null });
  });

  it("groups by member: yours first, then unseen (newest first), then fully seen; stories in posting order", async () => {
    // findMany returns them oldest first, as the query orders them.
    db.story.findMany.mockResolvedValue([
      story("f1", "friend", 120, true),
      story("o1", "followed", 90),
      story("m1", "me", 60, false, 4),
      story("f2", "friend", 30, true),
      story("o2", "followed", 10),
    ]);
    const groups = await listStories("me");
    expect(groups.map((g) => g.user.id)).toEqual(["me", "followed", "friend"]);
    expect(groups[1]!.stories.map((s) => s.id)).toEqual(["o1", "o2"]);
    expect(groups.map((g) => g.hasUnseen)).toEqual([false, true, false]);
  });

  it("shows the view count only on your own stories", async () => {
    db.story.findMany.mockResolvedValue([story("m1", "me", 5, false, 7), story("f1", "friend", 5, false, 3)]);
    const [mine, theirs] = await listStories("me");
    expect(mine!.stories[0]!.viewCount).toBe(7);
    expect(theirs!.stories[0]!.viewCount).toBeNull();
  });
});

describe("markStoryViewed", () => {
  it("records one view for a story from someone in your network", async () => {
    db.story.findFirst.mockResolvedValue({ userId: "friend" });
    expect(await markStoryViewed("me", "s1")).toBe(true);
    expect(db.storyView.createMany).toHaveBeenCalledWith({ data: [{ storyId: "s1", viewerId: "me" }], skipDuplicates: true });
  });

  it("doesn't count your own story", async () => {
    db.story.findFirst.mockResolvedValue({ userId: "me" });
    expect(await markStoryViewed("me", "s1")).toBe(true);
    expect(db.storyView.createMany).not.toHaveBeenCalled();
  });

  it("refuses expired or missing stories, and stories from outside your network or from blocked members", async () => {
    db.story.findFirst.mockResolvedValue(null);
    expect(await markStoryViewed("me", "gone")).toBe(false);
    db.story.findFirst.mockResolvedValue({ userId: "stranger" });
    expect(await markStoryViewed("me", "s2")).toBe(false);
    db.story.findFirst.mockResolvedValue({ userId: "blocked" });
    expect(await markStoryViewed("me", "s3")).toBe(false);
    expect(db.storyView.createMany).not.toHaveBeenCalled();
  });
});

describe("createStory", () => {
  it("expires 24 hours after posting", async () => {
    db.story.create.mockResolvedValue({});
    const before = Date.now();
    await createStory("me", "/api/v1/files/public/story/a.jpg", "Hello");
    const { expiresAt } = db.story.create.mock.calls[0]![0].data;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(STORY_TTL_MS - 1000);
    expect(expiresAt.getTime() - before).toBeLessThanOrEqual(STORY_TTL_MS + 1000);
  });
});
