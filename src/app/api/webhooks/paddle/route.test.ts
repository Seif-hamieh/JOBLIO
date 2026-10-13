import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const unmarshal = vi.fn();
const featuredDays = vi.fn();
vi.mock("@/server/paddle", () => ({ paddle: () => ({ webhooks: { unmarshal } }), featuredDays }));
const fulfillPayment = vi.fn();
const markPaymentFailed = vi.fn();
vi.mock("@/server/billing", () => ({ fulfillPayment, markPaymentFailed }));
const db = {
  webhookEvent: { create: vi.fn(), delete: vi.fn() },
  payment: { findUnique: vi.fn(), update: vi.fn() },
};
vi.mock("@/server/db", () => ({ db }));

process.env.PADDLE_WEBHOOK_SECRET = "test-secret";
const { POST } = await import("./route");

const request = () => new Request("http://localhost/api/webhooks/paddle", { method: "POST", headers: { "paddle-signature": "ts=1;h1=abc" }, body: "{}" });
const completed = (customData: unknown) => ({
  eventId: "evt_1",
  eventType: "transaction.completed",
  data: { id: "txn_1", customData, items: [{ price: { id: "pri_14" } }], currencyCode: "USD", details: { totals: { grandTotal: "500", total: "500" } } },
});
const pending = { id: "pay_1", product: "FEATURED_JOB", targetId: "job_1", status: "PENDING" };

beforeEach(() => {
  vi.clearAllMocks();
  db.webhookEvent.create.mockResolvedValue({});
  db.webhookEvent.delete.mockResolvedValue({});
  featuredDays.mockReturnValue(14);
});

describe("POST /api/webhooks/paddle", () => {
  it("rejects a request whose signature doesn't verify, without touching the database", async () => {
    unmarshal.mockRejectedValue(new Error("bad signature"));
    const res = await POST(request());
    expect(res.status).toBe(400);
    expect(db.webhookEvent.create).not.toHaveBeenCalled();
    expect(fulfillPayment).not.toHaveBeenCalled();
  });

  it("fulfils the matching payment on transaction.completed and records the charged amount", async () => {
    unmarshal.mockResolvedValue(completed({ paymentId: "pay_1", jobId: "job_1" }));
    db.payment.findUnique.mockResolvedValue(pending);
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(db.webhookEvent.create).toHaveBeenCalledWith({ data: { id: "paddle:evt_1", type: "transaction.completed" } });
    expect(db.payment.update).toHaveBeenCalledWith({ where: { id: "pay_1" }, data: { amount: 500, currency: "usd" } });
    expect(featuredDays).toHaveBeenCalledWith([{ price: { id: "pri_14" } }], { paymentId: "pay_1", jobId: "job_1" });
    expect(fulfillPayment).toHaveBeenCalledWith("pay_1", { days: 14 });
  });

  it("is idempotent: a redelivered event is acknowledged but not processed again", async () => {
    unmarshal.mockResolvedValue(completed({ paymentId: "pay_1", jobId: "job_1" }));
    db.webhookEvent.create.mockRejectedValue(new Error("unique constraint"));
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(fulfillPayment).not.toHaveBeenCalled();
  });

  it("ignores a transaction whose job doesn't match our payment", async () => {
    unmarshal.mockResolvedValue(completed({ paymentId: "pay_1", jobId: "another_job" }));
    db.payment.findUnique.mockResolvedValue(pending);
    expect((await POST(request())).status).toBe(200);
    expect(fulfillPayment).not.toHaveBeenCalled();
  });

  it("marks the payment failed on transaction.payment_failed", async () => {
    unmarshal.mockResolvedValue({ eventId: "evt_2", eventType: "transaction.payment_failed", data: { id: "txn_1", customData: { paymentId: "pay_1", jobId: "job_1" } } });
    db.payment.findUnique.mockResolvedValue(pending);
    expect((await POST(request())).status).toBe(200);
    expect(markPaymentFailed).toHaveBeenCalledWith("pay_1");
  });

  it("returns 500 and forgets the event when processing fails, so Paddle retries", async () => {
    unmarshal.mockResolvedValue(completed({ paymentId: "pay_1", jobId: "job_1" }));
    db.payment.findUnique.mockResolvedValue(pending);
    fulfillPayment.mockRejectedValue(new Error("db down"));
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect(db.webhookEvent.delete).toHaveBeenCalledWith({ where: { id: "paddle:evt_1" } });
  });
});
