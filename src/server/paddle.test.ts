import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/action", () => ({ ActionError: class ActionError extends Error {} }));
vi.mock("@/server/billing", () => ({ nextInvoiceNumber: async () => "JBL-TEST" }));
const db = { job: { findUnique: vi.fn() }, payment: { create: vi.fn(), update: vi.fn() } };
vi.mock("@/server/db", () => ({ db }));
const create = vi.fn();
vi.mock("@paddle/paddle-node-sdk", () => ({
  Environment: { sandbox: "sandbox", production: "production" },
  Paddle: class {
    transactions = { create };
  },
}));

Object.assign(process.env, { PADDLE_API_KEY: "k", PADDLE_CLIENT_TOKEN: "test_t", PADDLE_PRICE_FEATURED_JOB: "pri_1", PADDLE_ENVIRONMENT: "sandbox" });
const { canFeatureJob, startFeaturedJobCheckout } = await import("./paddle");

const viewer = (id: string, company: { id: string; role: "OWNER" | "ADMIN" | "RECRUITER" } | null) => ({ id, company }) as never;
const job = { id: "job_1", title: "Designer", companyId: "co", postedById: "poster", status: "OPEN", featuredUntil: null as Date | null };

beforeEach(() => {
  vi.clearAllMocks();
  db.payment.create.mockResolvedValue({ id: "pay_1" });
  create.mockResolvedValue({ id: "txn_1", checkout: { url: "https://example.test/pay?_ptxn=txn_1" } });
});

describe("canFeatureJob", () => {
  it("allows the poster and company owners/admins, not other recruiters or outsiders", () => {
    expect(canFeatureJob(viewer("poster", { id: "co", role: "RECRUITER" }), job)).toBe(true);
    expect(canFeatureJob(viewer("boss", { id: "co", role: "ADMIN" }), job)).toBe(true);
    expect(canFeatureJob(viewer("colleague", { id: "co", role: "RECRUITER" }), job)).toBe(false);
    expect(canFeatureJob(viewer("admin-elsewhere", { id: "other", role: "OWNER" }), job)).toBe(false);
    expect(canFeatureJob(null, job)).toBe(false);
  });

  it("hides the button for closed or already-featured jobs", () => {
    const poster = viewer("poster", null);
    expect(canFeatureJob(poster, { ...job, status: "CLOSED" })).toBe(false);
    expect(canFeatureJob(poster, { ...job, featuredUntil: new Date(Date.now() + 86_400_000) })).toBe(false);
    expect(canFeatureJob(poster, { ...job, featuredUntil: new Date(Date.now() - 86_400_000) })).toBe(true);
  });
});

describe("startFeaturedJobCheckout", () => {
  it("refuses a member who doesn't own the job, before creating anything", async () => {
    db.job.findUnique.mockResolvedValue(job);
    await expect(startFeaturedJobCheckout(viewer("stranger", null), "job_1")).rejects.toThrow("@msg.featureNotAllowed");
    expect(db.payment.create).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a job that is already featured", async () => {
    db.job.findUnique.mockResolvedValue({ ...job, featuredUntil: new Date(Date.now() + 86_400_000) });
    await expect(startFeaturedJobCheckout(viewer("poster", null), "job_1")).rejects.toThrow("@msg.alreadyFeatured");
  });

  it("creates a pending payment and a Paddle transaction that carries its id", async () => {
    db.job.findUnique.mockResolvedValue(job);
    const res = await startFeaturedJobCheckout(viewer("poster", null), "job_1");
    expect(db.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "poster", product: "FEATURED_JOB", targetId: "job_1", amount: 2000 }) });
    expect(create).toHaveBeenCalledWith({ items: [{ priceId: "pri_1", quantity: 1 }], customData: { paymentId: "pay_1", jobId: "job_1", userId: "poster" } });
    expect(res).toEqual({ transactionId: "txn_1", checkoutUrl: "https://example.test/pay?_ptxn=txn_1", paymentId: "pay_1" });
  });

  it("marks the payment failed if Paddle can't create the transaction", async () => {
    db.job.findUnique.mockResolvedValue(job);
    create.mockRejectedValue(new Error("paddle down"));
    await expect(startFeaturedJobCheckout(viewer("poster", null), "job_1")).rejects.toThrow("@msg.checkoutFailed");
    expect(db.payment.update).toHaveBeenCalledWith({ where: { id: "pay_1" }, data: { status: "FAILED" } });
  });
});
