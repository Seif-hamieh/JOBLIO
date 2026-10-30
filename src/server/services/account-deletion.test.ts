import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const order: string[] = [];
const deleteStored = vi.fn(async () => void order.push("files"));
vi.mock("@/server/storage", () => ({ deleteStored, storageDriver: () => "supabase" }));
const db = {
  job: { count: vi.fn(async () => 0), updateMany: vi.fn() },
  interview: { count: vi.fn(async () => 0), updateMany: vi.fn() },
  companyMember: { findFirst: vi.fn(async () => null) },
  user: { findUnique: vi.fn(async () => ({ image: "/api/v1/files/public/avatar/a.png" })), delete: vi.fn(async () => void order.push("user")) },
  profile: {
    findUnique: vi.fn(async () => ({
      coverUrl: "/api/v1/files/public/cover/c.jpg",
      resumeUrl: "/api/v1/files/private/resume/u1/cv.pdf",
      projects: [{ imageUrl: "/api/v1/files/public/project/p.png" }],
      portfolioItems: [{ url: "https://example.com", thumbnailUrl: null }],
    })),
  },
  post: { findMany: vi.fn(async () => [{ mediaUrls: ["/api/v1/files/public/media/u1/v.mp4"], thumbnailUrl: "/api/v1/files/public/media/u1/t.jpg" }]) },
  postDraft: { findMany: vi.fn(async () => [{ mediaUrls: ["/api/v1/files/public/post/d.png"] }]) },
  story: { findMany: vi.fn(async () => [{ mediaUrl: "/api/v1/files/public/story/s.jpg", thumbnailUrl: null }]) },
  article: { findMany: vi.fn(async () => [{ coverImage: "/api/v1/files/public/post/art.png" }]) },
  application: { findMany: vi.fn(async () => [{ resumeUrl: "/api/v1/files/private/resume/u1/copy.pdf" }]) },
  message: { findMany: vi.fn(async () => [{ attachmentUrl: "/api/v1/files/private/message/c1/f.zip" }]) },
  $transaction: vi.fn(),
};
vi.mock("@/server/db", () => ({ db }));

const { deleteAccount } = await import("./account-deletion");

describe("deleteAccount", () => {
  beforeEach(() => {
    order.length = 0;
    deleteStored.mockClear();
    db.user.delete.mockClear();
  });

  it("deletes the account, then every file it owned", async () => {
    expect(await deleteAccount("u1", null)).toBe("deleted");
    expect(order).toEqual(["user", "files"]);
    const files = (deleteStored.mock.calls[0] as unknown as [string[]])[0];
    for (const f of ["public/avatar/a.png", "public/cover/c.jpg", "private/resume/u1/cv.pdf", "public/project/p.png", "public/media/u1/v.mp4", "public/media/u1/t.jpg", "public/post/d.png", "public/story/s.jpg", "public/post/art.png", "private/resume/u1/copy.pdf", "private/message/c1/f.zip"]) {
      expect(files).toContain(`/api/v1/files/${f}`);
    }
  });

  it("keeps the account (and its files) when a recruiter's jobs have nobody to go to", async () => {
    db.job.count.mockResolvedValueOnce(2);
    expect(await deleteAccount("u1", "co1")).toBe("blocked");
    expect(db.user.delete).not.toHaveBeenCalled();
    expect(deleteStored).not.toHaveBeenCalled();
  });
});
