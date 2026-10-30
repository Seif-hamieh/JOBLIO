import { beforeEach, describe, expect, it, vi } from "vitest";

// Each test re-imports the Paddle module (and its SDK) from scratch; on a busy machine that can pass the default
// 5-second limit, which made these tests fail now and then. Give them room.
vi.setConfig({ testTimeout: 30_000 });

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

const BASE_ENV = { PADDLE_API_KEY: "k", PADDLE_CLIENT_TOKEN: "test_t", PADDLE_ENVIRONMENT: "sandbox", PADDLE_PRICE_FEATURED_JOB: "pri_legacy" };
const PLAN_ENV = { PADDLE_PRICE_FEATURED_JOB_7D: "pri_7", PADDLE_PRICE_FEATURED_JOB_14D: "pri_14", PADDLE_PRICE_FEATURED_JOB_30D: "pri_30" };

/** products.ts reads the price IDs when it loads, so each environment gets a fresh import. */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of [...Object.keys(BASE_ENV), ...Object.keys(PLAN_ENV)]) delete process.env[key];
  for (const [key, value] of Object.entries(env)) if (value !== undefined) process.env[key] = value;
  return import("./paddle");
}

const viewer = (id: string, company: { id: string; role: "OWNER" | "ADMIN" | "RECRUITER" } | null) => ({ id, company }) as never;
const job = { id: "job_1", title: "Designer", companyId: "co", postedById: "poster", status: "OPEN", featuredUntil: null as Date | null };

beforeEach(() => {
  vi.clearAllMocks();
  db.payment.create.mockResolvedValue({ id: "pay_1" });
  create.mockResolvedValue({ id: "txn_1", checkout: { url: "https://example.test/pay?_ptxn=txn_1" } });
});

describe("canFeatureJob", () => {
  it("allows the poster and company owners/admins, not other recruiters or outsiders", async () => {
    const { canFeatureJob } = await load({ ...BASE_ENV, ...PLAN_ENV });
    expect(canFeatureJob(viewer("poster", { id: "co", role: "RECRUITER" }), job)).toBe(true);
    expect(canFeatureJob(viewer("boss", { id: "co", role: "ADMIN" }), job)).toBe(true);
    expect(canFeatureJob(viewer("colleague", { id: "co", role: "RECRUITER" }), job)).toBe(false);
    expect(canFeatureJob(viewer("admin-elsewhere", { id: "other", role: "OWNER" }), job)).toBe(false);
    expect(canFeatureJob(null, job)).toBe(false);
  });

  it("hides the plans for closed or already-featured jobs", async () => {
    const { canFeatureJob } = await load({ ...BASE_ENV, ...PLAN_ENV });
    const poster = viewer("poster", null);
    expect(canFeatureJob(poster, { ...job, status: "CLOSED" })).toBe(false);
    expect(canFeatureJob(poster, { ...job, featuredUntil: new Date(Date.now() + 86_400_000) })).toBe(false);
    expect(canFeatureJob(poster, { ...job, featuredUntil: new Date(Date.now() - 86_400_000) })).toBe(true);
  });
});

describe("featured job plans", () => {
  it("offers the three plans in ascending price, without price IDs for the browser", async () => {
    const { featuredJobPlanOptions } = await load({ ...BASE_ENV, ...PLAN_ENV });
    expect(featuredJobPlanOptions()).toEqual([
      { code: "FEATURED_JOB_7D", durationDays: 7, amount: 300 },
      { code: "FEATURED_JOB_14D", durationDays: 14, amount: 500 },
      { code: "FEATURED_JOB_30D", durationDays: 30, amount: 800 },
    ]);
  });

  it("falls back to the original single 30-day price when the plan prices aren't configured", async () => {
    const { featuredJobPlans, paddleEnabled } = await load(BASE_ENV);
    expect(paddleEnabled()).toBe(true);
    expect(featuredJobPlans()).toEqual([{ code: "FEATURED_JOB_30D", priceId: "pri_legacy", durationDays: 30, amount: 2000 }]);
  });

  it("is off when no Featured Job price is configured at all", async () => {
    const { paddleEnabled } = await load({ ...BASE_ENV, PADDLE_PRICE_FEATURED_JOB: undefined });
    expect(paddleEnabled()).toBe(false);
  });

  it("takes the duration from the price that was paid, then custom_data, else null (product default)", async () => {
    const { featuredDays } = await load({ ...BASE_ENV, ...PLAN_ENV });
    expect(featuredDays([{ price: { id: "pri_14" } }], { durationDays: 30 })).toBe(14);
    expect(featuredDays([{ price: { id: "pri_unknown" } }], { durationDays: 7 })).toBe(7);
    expect(featuredDays([], { durationDays: 999 })).toBeNull();
    expect(featuredDays(null, null)).toBeNull();
  });
});

describe("startFeaturedJobCheckout", () => {
  it("refuses a member who doesn't own the job, before creating anything", async () => {
    const { startFeaturedJobCheckout } = await load({ ...BASE_ENV, ...PLAN_ENV });
    db.job.findUnique.mockResolvedValue(job);
    await expect(startFeaturedJobCheckout(viewer("stranger", null), "job_1", "FEATURED_JOB_14D")).rejects.toThrow("@msg.featureNotAllowed");
    expect(db.payment.create).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a job that is already featured", async () => {
    const { startFeaturedJobCheckout } = await load({ ...BASE_ENV, ...PLAN_ENV });
    db.job.findUnique.mockResolvedValue({ ...job, featuredUntil: new Date(Date.now() + 86_400_000) });
    await expect(startFeaturedJobCheckout(viewer("poster", null), "job_1", "FEATURED_JOB_7D")).rejects.toThrow("@msg.alreadyFeatured");
  });

  it("refuses a plan that isn't configured", async () => {
    const { startFeaturedJobCheckout } = await load(BASE_ENV); // legacy: only the 30-day plan exists
    db.job.findUnique.mockResolvedValue(job);
    await expect(startFeaturedJobCheckout(viewer("poster", null), "job_1", "FEATURED_JOB_7D")).rejects.toThrow("@msg.planUnavailable");
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("charges the chosen plan's price and passes its duration to Paddle", async () => {
    const { startFeaturedJobCheckout } = await load({ ...BASE_ENV, ...PLAN_ENV });
    db.job.findUnique.mockResolvedValue(job);
    const res = await startFeaturedJobCheckout(viewer("poster", null), "job_1", "FEATURED_JOB_14D");
    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "poster", product: "FEATURED_JOB", targetId: "job_1", amount: 500, description: "Featured Job · 14 days" }),
    });
    expect(create).toHaveBeenCalledWith({
      items: [{ priceId: "pri_14", quantity: 1 }],
      customData: { paymentId: "pay_1", jobId: "job_1", userId: "poster", planCode: "FEATURED_JOB_14D", durationDays: 14 },
    });
    expect(res).toEqual({ transactionId: "txn_1", checkoutUrl: "https://example.test/pay?_ptxn=txn_1", paymentId: "pay_1" });
  });

  it("marks the payment failed if Paddle can't create the transaction", async () => {
    const { startFeaturedJobCheckout } = await load({ ...BASE_ENV, ...PLAN_ENV });
    db.job.findUnique.mockResolvedValue(job);
    create.mockRejectedValue(new Error("paddle down"));
    await expect(startFeaturedJobCheckout(viewer("poster", null), "job_1", "FEATURED_JOB_30D")).rejects.toThrow("@msg.checkoutFailed");
    expect(db.payment.update).toHaveBeenCalledWith({ where: { id: "pay_1" }, data: { status: "FAILED" } });
  });
});
